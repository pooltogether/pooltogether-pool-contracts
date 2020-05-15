pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./Sponsorship.sol";
import "./LoyaltyFactory.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract SponsorshipFactory is Initializable, ProxyFactory {

  event SponsorshipCreated(address indexed sponsorship);

  Sponsorship public instance;
  LoyaltyFactory public loyaltyFactory;

  function initialize (
    LoyaltyFactory _loyaltyFactory
  ) public initializer {
    require(address(_loyaltyFactory) != address(0), "loyalty factory cannot be zero");
    instance = new Sponsorship();
    loyaltyFactory = _loyaltyFactory;
  }

  function createSponsorship() public returns (Sponsorship) {
    Sponsorship controlledToken = Sponsorship(deployMinimal(address(instance), ""));
    emit SponsorshipCreated(address(controlledToken));
    return controlledToken;
  }

  function createSponsorship(
    string memory _name,
    string memory _symbol,
    address _controller,
    address _trustedForwarder
  ) public returns (Sponsorship) {
    Sponsorship sponsorship = createSponsorship();
    Loyalty loyalty = loyaltyFactory.createLoyalty("", "", address(sponsorship), _trustedForwarder);
    sponsorship.initialize(
      _name,
      _symbol,
      _controller,
      _trustedForwarder,
      loyalty
    );
    return sponsorship;
  }
}