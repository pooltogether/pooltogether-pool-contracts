pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

import "./RNGInterface.sol";

contract RNGBlockhash is RNGInterface {
  using SafeMath for uint256;

  uint256 public requestCount;
  mapping(uint256 => bool) public completed;
  mapping(uint256 => bytes32) public randomNumbers;

  function requestRandomNumber(address token, uint256 budget) external override returns (uint256) {
    uint256 requestId = requestCount.add(1);
    completed[requestId] = true;
    randomNumbers[requestId] = blockhash(1);

    emit RandomNumberRequested(requestId, msg.sender, token, budget);
    emit RandomNumberCompleted(requestId, randomNumbers[requestId]);
    return requestId;
  }

  function isRequestComplete(uint256 id) external override view returns (bool) {
    return completed[id];
  }

  function randomNumber(uint256 id) external override view returns (bytes32) {
    return randomNumbers[id];
  }
}
