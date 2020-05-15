pragma solidity ^0.6.4;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@nomiclabs/buidler/console.sol";
import "../token/TokenControllerInterface.sol";

import "../util/ERC1820Constants.sol";
import "./ControlledToken.sol";
import "./Loyalty.sol";
import "../base/Module.sol";

// solium-disable security/no-block-members
contract Sponsorship is Meta777, Module {
  using SafeMath for uint256;

  function initialize (
    string memory _name,
    string memory _symbol,
    address _trustedForwarder
  ) public override initializer {
    Module.construct();
    Meta777.initialize(_name, _symbol, _trustedForwarder);
    ERC1820Constants.REGISTRY.setInterfaceImplementer(address(this), ERC1820Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  function mint(
    address account,
    uint256 amount
  ) external virtual authorized {
    _mint(account, amount, "", "");
  }

  function burn(
    address from,
    uint256 amount
  ) external virtual authorized {
    _burn(from, amount, "", "");
  }

  function testme() public pure returns (string memory) {
    return "HELLo this iS a teSt";
  }

  function hashName() public view override returns (bytes32) {
    return ERC1820Constants.SPONSORSHIP_INTERFACE_HASH;
  }

  function _msgSender() internal override(Meta777, ContextUpgradeSafe) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }
}
