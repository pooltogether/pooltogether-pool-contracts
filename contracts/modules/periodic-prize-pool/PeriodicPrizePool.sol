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

import "../yield-service/YieldServiceInterface.sol";
import "../sponsorship/Sponsorship.sol";
import "../interest-tracker/InterestTrackerInterface.sol";
import "./PeriodicPrizePoolInterface.sol";
import "../../prize-strategy/PrizeStrategyInterface.sol";
import "../../rng/RNGInterface.sol";
import "../../Constants.sol";

/* solium-disable security/no-block-members */
contract PeriodicPrizePool is ReentrancyGuardUpgradeSafe, PeriodicPrizePoolInterface, IERC777Recipient, NamedModule {
  using SafeMath for uint256;

  uint256 internal constant ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA = 13.4 ether;

  event PrizePoolOpened(address indexed operator, uint256 indexed prizePeriodStartedAt);
  event PrizePoolAwardStarted(address indexed operator, uint256 indexed rngRequestId);
  event PrizePoolAwardCompleted(address indexed operator, uint256 prize, uint256 reserveFee, bytes32 randomNumber);

  PrizeStrategyInterface public override prizeStrategy;
  GovernorInterface governor;
  RNGInterface public rng;
  uint256 public override prizePeriodSeconds;
  uint256 public override prizePeriodStartedAt;
  uint256 public previousPrize;
  uint256 public previousPrizeAverageTickets;
  uint256 public feeScaleMantissa;
  uint256 public rngRequestId;

  function initialize (
    NamedModuleManager _manager,
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
    Constants.REGISTRY.setInterfaceImplementer(address(this), Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
    prizePeriodStartedAt = block.timestamp;
    emit PrizePoolOpened(_msgSender(), prizePeriodStartedAt);
  }

  function hashName() public view override returns (bytes32) {
    return Constants.PRIZE_POOL_INTERFACE_HASH;
  }

  function currentPrize() public override returns (uint256) {
    uint256 balance = PrizePoolModuleManager(address(manager)).yieldService().unaccountedBalance();
    uint256 reserveFee = calculateReserveFee(balance);
    return balance.sub(reserveFee);
  }

  function calculateExitFee(address user, uint256 tickets) public view override returns (uint256) {
    return scaleValueByTimeRemaining(
      _calculateExitFeeWithValues(
        PrizePoolModuleManager(address(manager)).interestTracker().interestRatioMantissa(user),
        tickets,
        previousPrizeAverageTickets,
        previousPrize
      ),
      _prizePeriodRemainingSeconds(),
      prizePeriodSeconds
    );
  }

  function _calculateExitFeeWithValues(
    uint256 _userInterestRatioMantissa,
    uint256 _tickets,
    uint256 _previousPrizeAverageTickets,
    uint256 _previousPrize
  ) internal pure returns (uint256) {
    // If there were no tickets, then it doesn't matter
    if (_previousPrizeAverageTickets == 0) {
      return 0;
    }
    // user needs to collateralize their tickets the same as the previous prize.
    uint256 interestRatioMantissa = FixedPoint.calculateMantissa(_previousPrize, _previousPrizeAverageTickets);
    if (_userInterestRatioMantissa >= interestRatioMantissa) {
      return 0;
    }
    uint256 interestRatioDifferenceMantissa = interestRatioMantissa - _userInterestRatioMantissa;
    return FixedPoint.multiplyUintByMantissa(_tickets, interestRatioDifferenceMantissa);
  }

  function scaleValueByTimeRemaining(uint256 _value, uint256 _timeRemainingSeconds, uint256 _prizePeriodSeconds) internal pure returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(
      _value,
      FixedPoint.calculateMantissa(
        _timeRemainingSeconds < _prizePeriodSeconds ? _timeRemainingSeconds : _prizePeriodSeconds,
        _prizePeriodSeconds
      )
    );
  }

  function calculateReserveFee(uint256 amount) internal view returns (uint256) {
    if (governor.reserve() == address(0) || governor.reserveFeeMantissa() == 0) {
      return 0;
    }
    return FixedPoint.multiplyUintByMantissa(amount, governor.reserveFeeMantissa());
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
    uint256 remaining = PrizePoolModuleManager(address(manager)).yieldService().estimateAccruedInterestOverBlocks(
      PrizePoolModuleManager(address(manager)).yieldService().accountedBalance(),
      estimateRemainingBlocksToPrize(secondsPerBlockFixedPoint18)
    );
    uint256 reserveFee = calculateReserveFee(remaining);
    return remaining.sub(reserveFee);
  }

  function estimateRemainingBlocksToPrize(uint256 secondsPerBlockFixedPoint18) public view returns (uint256) {
    return FixedPoint.divideUintByMantissa(
      _prizePeriodRemainingSeconds(),
      secondsPerBlockFixedPoint18
    );
  }

  function prizePeriodRemainingSeconds() public view override returns (uint256) {
    return _prizePeriodRemainingSeconds();
  }

  function _prizePeriodRemainingSeconds() internal view returns (uint256) {
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

  function mintedTickets(uint256 amount) external override onlyManagerOrModule {
    previousPrizeAverageTickets = previousPrizeAverageTickets.add(
      scaleValueByTimeRemaining(
        amount,
        _prizePeriodRemainingSeconds(),
        prizePeriodSeconds
      )
    );
  }

  function redeemedTickets(uint256 amount) external override onlyManagerOrModule {
    previousPrizeAverageTickets = previousPrizeAverageTickets.sub(
      scaleValueByTimeRemaining(
        amount,
        _prizePeriodRemainingSeconds(),
        prizePeriodSeconds
      )
    );
  }

  function startAward() external override requireCanStartAward nonReentrant {
    rngRequestId = rng.requestRandomNumber(address(0),0);

    emit PrizePoolAwardStarted(_msgSender(), rngRequestId);
  }

  function completeAward() external override requireCanCompleteAward nonReentrant {
    YieldServiceInterface yieldService = PrizePoolModuleManager(address(manager)).yieldService();
    uint256 balance = yieldService.unaccountedBalance();
    uint256 reserveFee = calculateReserveFee(balance);
    uint256 prize = balance.sub(reserveFee);

    if (balance > 0) {
      yieldService.capture(balance);
      Sponsorship sponsorship = PrizePoolModuleManager(address(manager)).sponsorship();
      if (reserveFee > 0) {
        sponsorship.mint(governor.reserve(), reserveFee);
      }
      if (prize > 0) {
        sponsorship.mint(address(prizeStrategy), prize);
        PrizePoolModuleManager(address(manager)).interestTracker().accrueInterest(prize);
      }
    }
    bytes32 randomNumber = rng.randomNumber(rngRequestId);
    prizePeriodStartedAt = block.timestamp;
    prizeStrategy.award(uint256(randomNumber), prize);

    previousPrize = prize;
    previousPrizeAverageTickets = PrizePoolModuleManager(address(manager)).ticket().totalSupply();
    rngRequestId = 0;

    emit PrizePoolAwardCompleted(_msgSender(), prize, reserveFee, randomNumber);
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
