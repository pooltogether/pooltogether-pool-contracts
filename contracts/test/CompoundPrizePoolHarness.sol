pragma solidity 0.6.4;

import "../prize-pool/compound/CompoundPrizePool.sol";

/* solium-disable security/no-block-members */
contract CompoundPrizePoolHarness is CompoundPrizePool {

  uint256 public currentTime;

  function initializeAll(
    address _trustedForwarder,
    PrizeStrategyInterface _prizeStrategy,
    address[] memory _controlledTokens,
    uint256 _maxExitFeeMantissa,
    uint256 _maxTimelockDuration,
    CTokenInterface _cToken
  )
    public
  {
    CompoundPrizePool.initialize(
      _trustedForwarder,
      _prizeStrategy,
      _controlledTokens,
      _maxExitFeeMantissa,
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

  function setCurrentTime(uint256 _currentTime) external {
    currentTime = _currentTime;
  }

  function setTimelockBalance(uint256 _timelockBalance) external {
    timelockTotalSupply = _timelockBalance;
  }

  function _currentTime() internal override view returns (uint256) {
    return currentTime;
  }

}