pragma solidity >=0.5.0 <0.7.0;

interface ComptrollerInterface {
  function reserveRateMantissa() external view returns (uint256);
  function afterDepositTo(address to, uint256 amount, uint256 balance, uint256 totalSupply, address controlledToken, address referrer) external;
  function afterWithdrawFrom(address to, uint256 amount, uint256 balance, uint256 totalSupply, address controlledToken) external;
}
