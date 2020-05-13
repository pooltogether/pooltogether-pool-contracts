pragma solidity ^0.6.4;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./ControlledToken.sol";
import "./Loyalty.sol";

// solium-disable security/no-block-members
contract Sponsorship is ControlledToken {
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
  }

  function mint(
    address to,
    uint256 amount
  ) external override onlyController {
    _mint(to, amount, "", "");
    loyalty.supply(to, amount);
  }

  function rewardLoyalty(uint256 amount) external onlyController {
    loyalty.increaseCollateral(amount);
  }

  function burn(
    address from,
    uint256 amount
  ) external override onlyController {
    _burn(from, amount, "", "");
    loyalty.redeem(from, amount);
  }
}
