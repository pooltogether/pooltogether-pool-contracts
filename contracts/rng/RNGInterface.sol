pragma solidity ^0.6.4;

interface RNGInterface {
  event RandomNumberRequested(uint32 indexed id, address indexed sender, address token, uint256 budget);
  event RandomNumberCompleted(uint32 indexed id, uint256 randomNumber);

  function requestRandomNumber(address token, uint256 budget) external returns (uint32, uint32);
  function isRequestComplete(uint32 id) external view returns (bool);
  function randomNumber(uint32 id) external view returns (uint256);
}