pragma solidity 0.5.12;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Sender.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Implementer.sol";

contract MockERC777Sender is IERC777Sender, IERC1820Implementer {
  bytes32 constant private ERC1820_ACCEPT_MAGIC = keccak256(abi.encodePacked("ERC1820_ACCEPT_MAGIC"));
  bytes32 constant private TOKENS_SENDER_INTERFACE_HASH =
      0x29ddb589b1fb5fc7cf394961c1adf5f8c6454761adf795e67fe149f658abe895;

  uint256 public count;
  address public operator;
  address public from;
  address public to;
  uint256 public amount;
  bytes public userData;
  bytes public operatorData;

  function tokensToSend(
    address _operator,
    address _from,
    address _to,
    uint256 _amount,
    bytes calldata _userData,
    bytes calldata _operatorData
  ) external {
    count = count + 1;
    operator = _operator;
    from = _from;
    to = _to;
    amount = _amount;
    userData = _userData;
    operatorData = _operatorData;
  }

  function canImplementInterfaceForAddress(bytes32 interfaceHash, address) external view returns (bytes32) {
    if (interfaceHash == TOKENS_SENDER_INTERFACE_HASH) {
      return ERC1820_ACCEPT_MAGIC;
    } else {
      return bytes32(0x00);
    }
  }
}