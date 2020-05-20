pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./Sponsorship.sol";
import "./LoyaltyFactory.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract SponsorshipFactory is Initializable, ProxyFactory {

  Sponsorship public instance;

  function initialize () public initializer {
    instance = new Sponsorship();
  }

  function createSponsorship() public returns (Sponsorship) {
    return Sponsorship(deployMinimal(address(instance), ""));
  }
}