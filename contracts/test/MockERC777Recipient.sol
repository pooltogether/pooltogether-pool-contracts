pragma solidity 0.5.12;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Implementer.sol";

contract MockERC777Recipient is IERC777Recipient, IERC1820Implementer {
  bytes32 constant private ERC1820_ACCEPT_MAGIC = keccak256(abi.encodePacked("ERC1820_ACCEPT_MAGIC"));
  bytes32 constant private TOKENS_RECIPIENT_INTERFACE_HASH =
      0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b;

  uint256 public count;
  address public operator;
  address public from;
  address public to;
  uint256 public amount;
  bytes public userData;
  bytes public operatorData;

  function tokensReceived(
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
    if (interfaceHash == TOKENS_RECIPIENT_INTERFACE_HASH) {
      return ERC1820_ACCEPT_MAGIC;
    } else {
      return bytes32(0x00);
    }
  }
}