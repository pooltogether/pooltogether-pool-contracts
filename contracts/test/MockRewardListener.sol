pragma solidity 0.5.12;

import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Implementer.sol";
import "../IRewardListener.sol";

contract MockRewardListener is IRewardListener, IERC1820Implementer {
  bytes32 constant internal ERC1820_ACCEPT_MAGIC = keccak256(abi.encodePacked("ERC1820_ACCEPT_MAGIC"));

  address public lastWinner;
  uint256 public lastWinnings;
  uint256 public lastDrawId;

  function rewarded(address winner, uint256 winnings, uint256 drawId) external {
    lastWinner = winner;
    lastWinnings = winnings;
    lastDrawId = drawId;
  }

  function canImplementInterfaceForAddress(bytes32, address) external view returns (bytes32) {
    return ERC1820_ACCEPT_MAGIC;
  }
}