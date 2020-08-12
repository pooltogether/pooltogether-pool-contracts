pragma solidity 0.6.4;

import "../prize-strategy/PrizeStrategy.sol";

/* solium-disable security/no-block-members */
contract PrizeStrategyHarness is PrizeStrategy {

  uint256 internal time;
  function setCurrentTime(uint256 _time) external {
    // console.log("setCurrentTime( %s )", _time);
    time = _time;
  }

  function _currentTime() internal override view returns (uint256) {
    if (time == 0) {
      return block.timestamp;
    }
    // console.log("_currentTime(): %s", time);
    return time;
  }

  function setRngRequest(uint32 requestId, uint32 lockBlock) external {
    rngRequest.id = requestId;
    rngRequest.lockBlock = lockBlock;
  }

  function awardReserveFeesTest() external {
    uint256 balance = prizePool.awardBalance();
    uint256 reserveFee = _calculateReserveFee(balance);
    if (reserveFee > 0) {
      _awardSponsorship(address(comptroller), reserveFee);
    }
  }

}