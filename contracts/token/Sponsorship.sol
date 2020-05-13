pragma solidity ^0.6.4;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@nomiclabs/buidler/console.sol";
import "../token/TokenControllerInterface.sol";

import "./ControlledToken.sol";
import "./Loyalty.sol";

// solium-disable security/no-block-members
contract Sponsorship is ControlledToken, TokenControllerInterface {
  using SafeMath for uint256;

  Loyalty public loyalty;

  function initialize (
    string memory _name,
    string memory _symbol,
    address _controller,
    address _trustedForwarder,
    Loyalty _loyalty
  ) public virtual initializer {
    require(address(_controller) != address(0), "controller cannot be zero");
    require(address(_loyalty) != address(0), "loyalty must not be zero");
    require(address(_loyalty.controller()) == address(this), "loyalty controller does not match");
    super.initialize(_name, _symbol, _trustedForwarder);
    controller = _controller;
    loyalty = _loyalty;
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), ERC1820_TOKEN_CONTROLLER_INTERFACE_HASH, address(this));
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), ERC1820_TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  function rewardLoyalty(uint256 amount) external onlyController nonReentrant {
    loyalty.increaseCollateral(amount);
  }

  function _beforeTokenTransfer(address operator, address from, address to, uint256 tokenAmount) internal virtual override {
    super._beforeTokenTransfer(operator, from, to, tokenAmount);
    if (from != address(0)) {
      loyalty.redeem(from, tokenAmount);
    }
    if (to != address(0)) {
      loyalty.supply(to, tokenAmount);
    }
  }

  function beforeTokenTransfer(address, address from, address to, uint256) external override {
    require(from == address(0) || to == address(0), "no transfer allowed");
  }
}
