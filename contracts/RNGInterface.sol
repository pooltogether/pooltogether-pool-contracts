pragma solidity ^0.6.4;

interface RNGInterface {
  function requestRandomNumber(address token, uint256 budget) external returns (uint256);
  function isRequestComplete(uint256 id) external view returns (bool);
  function randomNumber(uint256 id) external view returns (bytes32);
}