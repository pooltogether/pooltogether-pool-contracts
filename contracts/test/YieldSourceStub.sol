pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface YieldSourceStub {
  function canAwardExternal(address _externalToken) external view returns (bool);

  function token() external view returns (IERC20Upgradeable);

  function balance() external returns (uint256);

  function supply(uint256 mintAmount) external;

  function redeem(uint256 redeemAmount) external returns (uint256);
}
