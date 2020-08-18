pragma solidity 0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

import "@pooltogether/pooltogether-rng-contracts/contracts/RNGInterface.sol";

contract RNGBlockhash is RNGInterface {
  using SafeMath for uint256;

  uint256 public requestCount;
  mapping(uint32 => bool) public completed;
  mapping(uint32 => uint256) public randomNumbers;

  function requestRandomNumber(address token, uint256 budget) external override returns (uint32 requestId, uint32 lockBlock) {
    requestId = uint32(requestCount.add(1));
    lockBlock = 1;
    completed[requestId] = true;
    randomNumbers[requestId] = uint256(blockhash(1));

    emit RandomNumberRequested(requestId, msg.sender, token, budget);
    emit RandomNumberCompleted(requestId, randomNumbers[requestId]);
  }

  function isRequestComplete(uint32 id) external override view returns (bool) {
    return completed[id];
  }

  function randomNumber(uint32 id) external override view returns (uint256) {
    return randomNumbers[id];
  }
}
