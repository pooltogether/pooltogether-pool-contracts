pragma solidity ^0.6.4;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@nomiclabs/buidler/console.sol";

import "../../Constants.sol";
import "../../token/TokenModule.sol";

// solium-disable security/no-block-members
contract Sponsorship is TokenModule {
  using SafeMath for uint256;

  function initialize (
    ModuleManager _manager,
    address _trustedForwarder,
    string memory _name,
    string memory _symbol
  ) public override initializer {
    TokenModule.initialize(_manager, _trustedForwarder, _name, _symbol);
    Constants.REGISTRY.setInterfaceImplementer(address(this), Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  function mint(
    address account,
    uint256 amount
  ) external virtual onlyManagerOrModule {
    _mint(account, amount, "", "");
  }

  function burn(
    address from,
    uint256 amount
  ) external virtual onlyManagerOrModule {
    _burn(from, amount, "", "");
  }

  function hashName() public view override returns (bytes32) {
    return Constants.SPONSORSHIP_INTERFACE_HASH;
  }
}
