pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@pooltogether/governor-contracts/contracts/GovernorInterface.sol";
import "@nomiclabs/buidler/console.sol";

import "../../base/OwnableModuleManager.sol";
import "../yield-service/YieldServiceInterface.sol";
import "../sponsorship/Sponsorship.sol";
import "../loyalty/LoyaltyInterface.sol";
import "./PeriodicPrizePoolInterface.sol";
import "../../prize-strategy/PrizeStrategyInterface.sol";
import "../../rng/RNGInterface.sol";
import "../../Constants.sol";

/* solium-disable security/no-block-members */
contract PeriodicPrizePool is ReentrancyGuardUpgradeSafe, PeriodicPrizePoolInterface, IERC777Recipient, NamedModule {
  using SafeMath for uint256;

  PrizeStrategyInterface public override prizeStrategy;
  GovernorInterface governor;
  RNGInterface public rng;
  uint256 public override prizePeriodStartedAt;
  uint256 public override prizePeriodSeconds;
  uint256 public previousPrize;
  uint256 public feeScaleMantissa;
  uint256 public rngRequestId;

  uint256 internal constant ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA = 13.4 ether;

  function initialize (
    ModuleManager _manager,
    address _trustedForwarder,
    GovernorInterface _governor,
    PrizeStrategyInterface _prizeStrategy,
    RNGInterface _rng,
    uint256 _prizePeriodSeconds
  ) public initializer {
    require(address(_governor) != address(0), "governor cannot be zero");
    require(address(_prizeStrategy) != address(0), "prize strategy must not be zero");
    require(_prizePeriodSeconds > 0, "prize period must be greater than zero");
    require(address(_rng) != address(0), "rng cannot be zero");
    NamedModule.construct(_manager, _trustedForwarder);
    __ReentrancyGuard_init();
    governor = _governor;
    prizeStrategy = _prizeStrategy;
    rng = _rng;
    prizePeriodSeconds = _prizePeriodSeconds;
    prizePeriodStartedAt = block.timestamp;
    Constants.REGISTRY.setInterfaceImplementer(address(this), Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  function hashName() public view override returns (bytes32) {
    return Constants.PRIZE_POOL_INTERFACE_HASH;
  }

  function currentPrize() public override returns (uint256) {
    uint256 balance = yieldService().unaccountedBalance();
    uint256 reserveFee = calculateReserveFee(balance);
    return balance.sub(reserveFee);
  }

  function calculateRemainingPreviousPrize() public view override returns (uint256) {
    return multiplyByRemainingTimeFraction(previousPrize);
  }

  function multiplyByRemainingTimeFraction(uint256 value) public view returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(
      value,
      FixedPoint.calculateMantissa(prizePeriodRemainingSeconds(), prizePeriodSeconds)
    );
  }

  function calculateExitFee(address, uint256 tickets) public view override returns (uint256) {
    uint256 totalSupply = ticket().totalSupply();
    if (totalSupply == 0) {
      return 0;
    }
    return FixedPoint.multiplyUintByMantissa(
      calculateRemainingPreviousPrize(),
      FixedPoint.calculateMantissa(tickets, totalSupply)
    );
  }

  function calculateReserveFee(uint256 amount) public view returns (uint256) {
    if (governor.reserve() != address(0) && governor.reserveFeeMantissa() > 0) {
      return FixedPoint.multiplyUintByMantissa(amount, governor.reserveFeeMantissa());
    }
    return 0;
  }

  function calculateUnlockTimestamp(address, uint256) public view override returns (uint256) {
    return prizePeriodEndAt();
  }

  function estimatePrize() public override returns (uint256) {
    return estimatePrizeWithBlockTime(ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA);
  }

  function estimatePrizeWithBlockTime(uint256 secondsPerBlockFixedPoint18) public override returns (uint256) {
    return currentPrize().add(estimateRemainingPrizeWithBlockTime(secondsPerBlockFixedPoint18));
  }

  function estimateRemainingPrize() public view override returns (uint256) {
    return estimateRemainingPrizeWithBlockTime(ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA);
  }

  function estimateRemainingPrizeWithBlockTime(uint256 secondsPerBlockFixedPoint18) public view override returns (uint256) {
    return yieldService().estimateAccruedInterestOverBlocks(
      yieldService().accountedBalance(),
      estimateRemainingBlocksToPrize(secondsPerBlockFixedPoint18)
    );
  }

  function estimateRemainingBlocksToPrize(uint256 secondsPerBlockFixedPoint18) public view returns (uint256) {
    return FixedPoint.divideUintByMantissa(
      prizePeriodRemainingSeconds(),
      secondsPerBlockFixedPoint18
    );
  }

  function prizePeriodRemainingSeconds() public view override returns (uint256) {
    uint256 endAt = prizePeriodEndAt();
    if (block.timestamp > endAt) {
      return 0;
    } else {
      return endAt - block.timestamp;
    }
  }

  function isPrizePeriodOver() public view returns (bool) {
    return block.timestamp > prizePeriodEndAt();
  }

  function isRngRequested() public view returns (bool) {
    return rngRequestId != 0;
  }

  function isRngCompleted() public view returns (bool) {
    return rng.isRequestComplete(rngRequestId);
  }

  function canStartAward() public view override returns (bool) {
    return isPrizePeriodOver() && !isRngRequested();
  }

  function canCompleteAward() public view override returns (bool) {
    return isRngRequested() && isRngCompleted();
  }

  function startAward() external override requireCanStartAward nonReentrant {
    rngRequestId = rng.requestRandomNumber(address(0),0);
  }

  function completeAward() external override requireCanCompleteAward nonReentrant {
    uint256 balance = yieldService().unaccountedBalance();
    uint256 reserveFee = calculateReserveFee(balance);
    uint256 prize = balance.sub(reserveFee);

    if (balance > 0) {
      yieldService().capture(balance);
      if (reserveFee > 0) {
        sponsorship().mint(governor.reserve(), reserveFee);
      }
      if (prize > 0) {
        // console.log("mint...");
        sponsorship().mint(address(prizeStrategy), prize);
        // console.log("reward loyalty...");
        loyalty().reward(prize);
      }
    }

    // console.log("awarding prize...");
    prizePeriodStartedAt = block.timestamp;
    prizeStrategy.award(uint256(rng.randomNumber(rngRequestId)), prize);

    previousPrize = prize;
    rngRequestId = 0;
  }

  function prizePeriodEndAt() public view override returns (uint256) {
    // current prize started at is non-inclusive, so add one
    return prizePeriodStartedAt + prizePeriodSeconds;
  }

  function tokensReceived(
    address operator,
    address from,
    address to,
    uint256 amount,
    bytes calldata userData,
    bytes calldata operatorData
  ) external override {
  }

  function loyalty() public view returns (LoyaltyInterface) {
    return LoyaltyInterface(getInterfaceImplementer(Constants.LOYALTY_INTERFACE_HASH));
  }

  function sponsorship() public view override returns (Sponsorship) {
    return Sponsorship(getInterfaceImplementer(Constants.SPONSORSHIP_INTERFACE_HASH));
  }

  function yieldService() public view override returns (YieldServiceInterface) {
    return YieldServiceInterface(getInterfaceImplementer(Constants.YIELD_SERVICE_INTERFACE_HASH));
  }

  function ticket() public view override returns (Ticket) {
    return Ticket(getInterfaceImplementer(Constants.TICKET_INTERFACE_HASH));
  }

  modifier requireCanStartAward() {
    require(isPrizePeriodOver(), "prize period not over");
    require(!isRngRequested(), "rng has already been requested");
    _;
  }

  modifier requireCanCompleteAward() {
    require(isRngRequested(), "no rng request has been made");
    require(isRngCompleted(), "rng request has not completed");
    _;
  }

  modifier notRequestingRN() {
    require(rngRequestId == 0, "rng request is in flight");
    _;
  }

}
