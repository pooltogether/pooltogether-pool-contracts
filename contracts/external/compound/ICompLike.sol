pragma solidity >=0.6.0 <0.7.0;

interface ICompLike {
  function balanceOf(address addr) external view returns (uint256);
  function delegate(address delegatee) external;
}
