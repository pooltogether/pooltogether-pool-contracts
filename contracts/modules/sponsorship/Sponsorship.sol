pragma solidity ^0.6.4;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@nomiclabs/buidler/console.sol";

import "../../module-manager/PrizePoolModuleManager.sol";
import "../interest-tracker/InterestTrackerInterface.sol";
import "../../Constants.sol";
import "../../base/TokenModule.sol";
import "../credit/Credit.sol";

// solium-disable security/no-block-members
contract Sponsorship is TokenModule {
  using SafeMath for uint256;

  mapping(address => uint256) interestShares;

  function initialize (
    NamedModuleManager _manager,
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
    uint256 shares = PrizePoolModuleManager(address(manager)).interestTracker().supplyCollateral(amount);
    interestShares[account] = interestShares[account].add(shares);
  }

  function burn(
    address from,
    uint256 amount
  ) external virtual onlyManagerOrModule {
    _burn(from, amount, "", "");
    uint256 shares = PrizePoolModuleManager(address(manager)).interestTracker().redeemCollateral(amount);
    interestShares[from] = interestShares[from].sub(shares);
  }

  function _sweep(address user) internal {
    address[] memory users = new address[](1);
    users[0] = user;
    sweep(users);
  }

  function _sweep(address[] memory users) internal {
    InterestTrackerInterface interestTracker = PrizePoolModuleManager(address(manager)).interestTracker();
    Credit sponsorshipCredit = PrizePoolModuleManager(address(manager)).sponsorshipCredit();
    uint256 exchangeRateMantissa = interestTracker.exchangeRateMantissa();
    for (uint256 i = 0; i < users.length; i++) {
      address user = users[i];
      uint256 total = FixedPoint.divideUintByMantissa(interestShares[user], exchangeRateMantissa);
      uint256 spareChange = total.sub(balanceOf(user));
      sponsorshipCredit.mint(user, spareChange);
      uint256 shares = interestTracker.redeemCollateral(spareChange);
      interestShares[user] = interestShares[user].sub(shares);
    }
  }

  function sweep(address[] memory users) public {
    _sweep(users);
  }

  function hashName() public view override returns (bytes32) {
    return Constants.SPONSORSHIP_INTERFACE_HASH;
  }
}
