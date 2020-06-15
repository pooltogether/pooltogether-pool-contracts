pragma solidity ^0.6.4;

import "../modules/sponsorship/Sponsorship.sol";

contract SponsorshipHarness is Sponsorship {
  function mintForTest(address user, uint256 amount) public {
    _mint(user, amount, "", "");
  }

  function setInterestSharesForTest(address user, uint256 amount) public {
    interestShares[user] = amount;
  }
}