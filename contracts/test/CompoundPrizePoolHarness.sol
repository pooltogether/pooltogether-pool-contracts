pragma solidity ^0.6.4;

import "../prize-pool/compound/CompoundPrizePool.sol";

/* solium-disable security/no-block-members */
contract CompoundPrizePoolHarness is CompoundPrizePool {

  uint256 internal time;

  function initializeAll(
    address _trustedForwarder,
    PrizeStrategyInterface _prizeStrategy,
    address[] memory _controlledTokens,
    uint256 _maxExitFeeMultiple,
    uint256 _maxTimelockDuration,
    CTokenInterface _cToken
  )
    public
  {
    CompoundPrizePool.initialize(
      _trustedForwarder,
      _prizeStrategy,
      _controlledTokens,
      _maxExitFeeMultiple,
      _maxTimelockDuration,
      _cToken
    );
  }

  function supply(uint256 mintAmount) external {
    _supply(mintAmount);
  }

  function redeem(uint256 redeemAmount) external {
    _redeem(redeemAmount);
  }

  function setCurrentTime(uint256 _time) external {
    time = _time;
  }

  function setTimelockBalance(uint256 _timelockBalance) external {
    timelockTotalSupply = _timelockBalance;
  }

  function _currentTime() internal override view returns (uint256) {
    if (time == 0) {
      return block.timestamp;
    }
    return time;
  }

}