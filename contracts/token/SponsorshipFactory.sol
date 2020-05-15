pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./Sponsorship.sol";
import "./LoyaltyFactory.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract SponsorshipFactory is Initializable, ProxyFactory {

  event SponsorshipCreated(address indexed sponsorship);

  Sponsorship public instance;

  function initialize () public initializer {
    instance = new Sponsorship();
  }

  function createSponsorship() public returns (Sponsorship) {
    Sponsorship controlledToken = Sponsorship(deployMinimal(address(instance), ""));
    emit SponsorshipCreated(address(controlledToken));
    return controlledToken;
  }

  function createSponsorship(
    string memory _name,
    string memory _symbol,
    address _trustedForwarder
  ) public returns (Sponsorship) {
    Sponsorship sponsorship = createSponsorship();
    sponsorship.initialize(
      _name,
      _symbol,
      _trustedForwarder
    );
    sponsorship.transferOwnership(msg.sender);
    return sponsorship;
  }
}