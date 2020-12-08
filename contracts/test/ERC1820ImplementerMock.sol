pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts-upgradeable/introspection/IERC1820ImplementerUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC777/IERC777RecipientUpgradeable.sol";

import "../Constants.sol";

contract ERC1820ImplementerMock is IERC1820ImplementerUpgradeable, IERC777RecipientUpgradeable {

  constructor () public {
    Constants.REGISTRY.setInterfaceImplementer(address(this), Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  function canImplementInterfaceForAddress(bytes32, address) external view virtual override returns(bytes32) {
    return Constants.ACCEPT_MAGIC;
  }

  function tokensReceived(
    address operator,
    address from,
    address to,
    uint256 amount,
    bytes calldata userData,
    bytes calldata operatorData
  ) external override {
  }
}