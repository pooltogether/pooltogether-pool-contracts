pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@nomiclabs/buidler/console.sol";

import "../base/ModuleManager.sol";
import "../token/ControlledTokenFactory.sol";
import "../yield-service/YieldServiceInterface.sol";
import "../yield-service/YieldServiceConstants.sol";
import "../token/TokenControllerInterface.sol";
import "../token/Sponsorship.sol";
import "../token/LoyaltyInterface.sol";
import "./PrizePoolInterface.sol";
import "../prize-strategy/PrizeStrategyInterface.sol";
import "../rng/RNGInterface.sol";
import "../util/ERC1820Constants.sol";
import "../token/ControlledTokenFactory.sol";

/* solium-disable security/no-block-members */
contract PeriodicPrizePool is ReentrancyGuardUpgradeSafe, OwnableUpgradeSafe, BaseRelayRecipient, PrizePoolInterface, IERC777Recipient, ModuleManager {
  using SafeMath for uint256;

  event TicketsRedeemedInstantly(address indexed to, uint256 amount, uint256 fee);
  event TicketsRedeemedWithTimelock(address indexed to, uint256 amount, uint256 unlockTimestamp);

  PrizeStrategyInterface public override prizeStrategy;
  
  RNGInterface public rng;
  uint256 public currentPrizeStartedAt;
  uint256 prizePeriodSeconds;
  uint256 public previousPrize;
  uint256 public feeScaleMantissa;
  uint256 public rngRequestId;

  function initialize (
    address _trustedForwarder,
    PrizeStrategyInterface _prizeStrategy,
    RNGInterface _rng,
    uint256 _prizePeriodSeconds
  ) public initializer {
    require(address(_prizeStrategy) != address(0), "prize strategy must not be zero");
    require(_prizePeriodSeconds > 0, "prize period must be greater than zero");
    require(address(_rng) != address(0), "rng cannot be zero");
    setupModules(address(0), "");
    __Ownable_init();
    __ReentrancyGuard_init();
    prizeStrategy = _prizeStrategy;
    trustedForwarder = _trustedForwarder;
    rng = _rng;
    prizePeriodSeconds = _prizePeriodSeconds;
    currentPrizeStartedAt = block.timestamp;
    ERC1820Constants.REGISTRY.setInterfaceImplementer(address(this), ERC1820Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  function currentPrize() public override returns (uint256) {
    return yieldService().unaccountedBalance();
  }

  function calculateRemainingPreviousPrize() public view override returns (uint256) {
    return multiplyByRemainingTimeFraction(previousPrize);
  }

  function multiplyByRemainingTimeFraction(uint256 value) public view returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(
      value,
      FixedPoint.calculateMantissa(remainingSecondsToPrize(), prizePeriodSeconds)
    );
  }

  function calculateUnlockTimestamp(address, uint256) public view override returns (uint256) {
    return prizePeriodEndAt();
  }

  function estimatePrize(uint256 secondsPerBlockFixedPoint18) external returns (uint256) {
    return currentPrize().add(estimateRemainingPrizeWithBlockTime(secondsPerBlockFixedPoint18));
  }

  function estimateRemainingPrize() public view returns (uint256) {
    return estimateRemainingPrizeWithBlockTime(13 ether);
  }

  function estimateRemainingPrizeWithBlockTime(uint256 secondsPerBlockFixedPoint18) public view returns (uint256) {
    return yieldService().estimateAccruedInterestOverBlocks(
      yieldService().accountedBalance(),
      estimateRemainingBlocksToPrize(secondsPerBlockFixedPoint18)
    );
  }

  function estimateRemainingBlocksToPrize(uint256 secondsPerBlockFixedPoint18) public view returns (uint256) {
    return FixedPoint.divideUintByMantissa(
      remainingSecondsToPrize(),
      secondsPerBlockFixedPoint18
    );
  }

  function remainingSecondsToPrize() public view returns (uint256) {
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

    uint256 prize = currentPrize();
    if (prize > 0) {
      yieldService().capture(prize);
      sponsorship().mint(address(this), prize);
      sponsorship().approve(address(prizeStrategy), prize);
    }

    loyalty().reward(prize);

    currentPrizeStartedAt = block.timestamp;
    prizeStrategy.award(uint256(rng.randomNumber(rngRequestId)), prize);

    previousPrize = prize;
    rngRequestId = 0;
  }

  function token() external override view returns (IERC20) {
    return yieldService().token();
  }

  function prizePeriodEndAt() public view returns (uint256) {
    // current prize started at is non-inclusive, so add one
    return currentPrizeStartedAt + prizePeriodSeconds;
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

  function getInterfaceImplementer(bytes32 name) public view returns (address) {
    return ERC1820Constants.REGISTRY.getInterfaceImplementer(address(this), name);
  }

  function _msgSender() internal override(BaseRelayRecipient, ContextUpgradeSafe) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }

  function loyalty() public view returns (LoyaltyInterface) {
    return LoyaltyInterface(getInterfaceImplementer(ERC1820Constants.LOYALTY_INTERFACE_HASH));
  }

  function sponsorship() public view override returns (Sponsorship) {
    return Sponsorship(getInterfaceImplementer(ERC1820Constants.SPONSORSHIP_INTERFACE_HASH));
  }

  function yieldService() public view override returns (YieldServiceInterface) {
    return YieldServiceInterface(getInterfaceImplementer(ERC1820Constants.YIELD_SERVICE_INTERFACE_HASH));
  }

  function ticket() public view override returns (Ticket) {
    return Ticket(getInterfaceImplementer(ERC1820Constants.TICKET_INTERFACE_HASH));
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
