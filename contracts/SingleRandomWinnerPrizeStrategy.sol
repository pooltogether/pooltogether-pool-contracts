pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "./RNGInterface.sol";
import "./DistributionStrategyInterface.sol";
import "./PrizePoolInterface.sol";

/* solium-disable security/no-block-members */
contract SingleRandomWinnerPrizeStrategy is Initializable, DistributionStrategyInterface {
  using SafeMath for uint256;

  RNGInterface public rng;

  mapping(address => uint256) rngRequestIds;

  function initialize(
    RNGInterface _rng
  ) public initializer {
    require(address(_rng) != address(0), "rng cannot be zero");
    rng = _rng;
  }

  function startAward() external override {
    rngRequestIds[msg.sender] = rng.requestRandomNumber(address(0),0);
  }

  function completeAward(uint256 prize) external override onlyRngRequestComplete(msg.sender) {
    PrizePoolInterface prizePool = PrizePoolInterface(msg.sender);
    uint256 requestId = rngRequestIds[msg.sender];
    address winner = prizePool.ticket().draw(uint256(rng.randomNumber(requestId)));
    // Reset the request
    rngRequestIds[msg.sender] = 0;
    // Transfer the winnings to the winner
    prizePool.ticket().transfer(winner, prize);
  }

  function requestIdOf(address sender) public view returns (uint256) {
    return rngRequestIds[sender];
  }

  modifier onlyRngRequestComplete(address sender) {
    require(rng.isRequestComplete(rngRequestIds[sender]), "rng request has not completed");
    _;
  }

  modifier notRequestingRN(address sender) {
    require(rngRequestIds[sender] == 0, "rng request is in flight");
    _;
  }
}
