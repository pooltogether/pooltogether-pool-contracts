pragma solidity >=0.6.0 <0.7.0;

interface ISablier {
  function getStream(uint256 streamId) external view returns (
    address sender,
    address recipient,
    address tokenAddress,
    uint256 balance,
    uint256 startTime,
    uint256 stopTime,
    uint256 remainingBalance,
    uint256 ratePerSecond
  );
  function withdrawFromStream(uint256 streamId, uint256 amount) external returns (bool);
  function balanceOf(uint256 streamId, address who) external view returns (uint256);
}
