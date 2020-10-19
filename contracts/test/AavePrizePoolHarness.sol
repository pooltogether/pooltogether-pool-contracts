pragma solidity >=0.6.0 <0.7.0;

import "../prize-pool/aave/AavePrizePool.sol";
import "../external/aave/LendingPoolInterface.sol";

/* solium-disable security/no-block-members */
contract AavePrizePoolHarness is AavePrizePool {

  uint256 public currentTime;

  function setCurrentTime(uint256 _currentTime) external {
    currentTime = _currentTime;
  }

  function setTimelockBalance(uint256 _timelockBalance) external {
    timelockTotalSupply = _timelockBalance;
  }

  function _currentTime() internal override view returns (uint256) {
    return currentTime;
  }

  function supply(uint256 amount) external {
    _supply(amount);
  }

  function redeem(uint256 redeemAmount) external returns (uint256) {
    return _redeem(redeemAmount);
  }

  function aToken() external view returns (ATokenInterface) {
    return _aToken();
  }

  function tokenAddress() external view returns (address) {
    return _tokenAddress();
  }

  function provider() external view returns (LendingPoolAddressesProviderInterface) {
    return _provider();
  }

  function lendingPool() external view returns (LendingPoolInterface) {
    return LendingPoolInterface(_provider().getLendingPool());
  }
}
