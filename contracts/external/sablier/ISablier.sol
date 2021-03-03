// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

interface ISablier {
  event CreateStream(
    uint256 indexed streamId,
    address indexed sender,
    address indexed recipient,
    uint256 deposit,
    address tokenAddress,
    uint256 startTime,
    uint256 stopTime
  );

  function createStream(
    address recipient,
    uint256 deposit,
    address tokenAddress,
    uint256 startTime,
    uint256 stopTime
  ) external returns (uint256);

  function getStream(uint256 streamId) external view returns (
    address sender,
    address recipient,
    uint256 deposit,
    address tokenAddress,
    uint256 startTime,
    uint256 stopTime,
    uint256 balance,
    uint256 rate
  );

  function withdrawFromStream(uint256 streamId, uint256 amount) external returns (bool);

  function balanceOf(uint256 streamId, address who) external view returns (uint256);

  function cancelStream(uint256 streamId) external returns (bool);
}
