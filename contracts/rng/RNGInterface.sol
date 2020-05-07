pragma solidity ^0.6.4;

interface RNGInterface {
  event RandomNumberRequested(uint256 indexed id, address indexed sender, address token, uint256 budget);
  event RandomNumberCompleted(uint256 indexed id, bytes32 randomNumber);

  function requestRandomNumber(address token, uint256 budget) external returns (uint256);
  function isRequestComplete(uint256 id) external view returns (bool);
  function randomNumber(uint256 id) external view returns (bytes32);
}