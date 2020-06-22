pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import "@nomiclabs/buidler/console.sol";

import "../ticket/TicketInterface.sol";
import "../rng/RNGInterface.sol";
import "./SingleRandomWinnerPrizeStrategyInterface.sol";
import "../periodic-prize-pool/PeriodicPrizePoolInterface.sol";
import "../Constants.sol";

/* solium-disable security/no-block-members */
contract SingleRandomWinnerPrizeStrategy is Initializable, BaseRelayRecipient, SingleRandomWinnerPrizeStrategyInterface, IERC777Recipient {
  using SafeMath for uint256;

  event PrizePoolAwardStarted(address indexed operator, address indexed prizePool, uint256 indexed rngRequestId);

  RNGInterface public rng;
  mapping(address => uint256) public rngRequestIds;

  function initialize(
    address _trustedForwarder,
    RNGInterface _rng
  ) public initializer {
    require(address(_rng) != address(0), "rng cannot be zero");
    trustedForwarder = _trustedForwarder;
    rng = _rng;
  }

  function startAward(PeriodicPrizePoolInterface prizePool) external override requireCanStartAward(prizePool) {
    require(prizePool.prizeStrategy() == address(this), "not prize strategy");
    uint256 requestId = rng.requestRandomNumber(address(0),0);
    rngRequestIds[address(prizePool)] = requestId;

    emit PrizePoolAwardStarted(_msgSender(), address(prizePool), requestId);
  }

  function completeAward(PeriodicPrizePoolInterface prizePool, bytes calldata data) external override requireCanCompleteAward(prizePool) {
    uint256 requestId = rngRequestIds[address(prizePool)];
    bytes32 randomNumber = rng.randomNumber(requestId);
    uint256 prize = prizePool.awardPrize();
    delete rngRequestIds[address(prizePool)];
    if (prize > 0) {
      TicketInterface ticket = prizePool.ticket();
      address winner = ticket.draw(uint256(randomNumber));
      prizePool.awardTickets(winner, prize, data);
    }
  }

  modifier requireCanStartAward(PeriodicPrizePoolInterface prizePool) {
    require(prizePool.isPrizePeriodOver(), "prize period not over");
    require(!isRngRequested(prizePool), "rng has already been requested");
    _;
  }

  modifier requireCanCompleteAward(PeriodicPrizePoolInterface prizePool) {
    require(isRngRequested(prizePool), "no rng request has been made");
    require(isRngCompleted(prizePool), "rng request has not completed");
    _;
  }

  function canStartAward(PeriodicPrizePoolInterface prizePool) public view override returns (bool) {
    return prizePool.isPrizePeriodOver() && !isRngRequested(prizePool);
  }

  function canCompleteAward(PeriodicPrizePoolInterface prizePool) public view override returns (bool) {
    return isRngRequested(prizePool) && isRngCompleted(prizePool);
  }

  function isRngRequested(PeriodicPrizePoolInterface prizePool) public view returns (bool) {
    return rngRequestIds[address(prizePool)] != 0;
  }

  function isRngCompleted(PeriodicPrizePoolInterface prizePool) public view returns (bool) {
    return rng.isRequestComplete(rngRequestIds[address(prizePool)]);
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
}
