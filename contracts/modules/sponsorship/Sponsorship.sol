pragma solidity ^0.6.4;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@nomiclabs/buidler/console.sol";

import "../../module-manager/PrizePoolModuleManager.sol";
import "../interest-tracker/InterestTrackerInterface.sol";
import "../yield-service/YieldServiceInterface.sol";
import "../credit/Credit.sol";
import "../../Constants.sol";
import "../../base/TokenModule.sol";

// solium-disable security/no-block-members
contract Sponsorship is TokenModule, ReentrancyGuardUpgradeSafe {
  using SafeMath for uint256;

  event SponsorshipSupplied(address indexed operator, address indexed to, uint256 amount);
  event SponsorshipRedeemed(address indexed operator, address indexed from, uint256 amount);

  mapping(address => uint256) interestShares;
  YieldServiceInterface public yieldService;

  function initialize (
    NamedModuleManager _manager,
    address _trustedForwarder,
    string memory _name,
    string memory _symbol
  ) public override initializer {
    TokenModule.initialize(_manager, _trustedForwarder, _name, _symbol);
    __ReentrancyGuard_init();
    Constants.REGISTRY.setInterfaceImplementer(address(this), Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
    yieldService = PrizePoolModuleManager(address(_manager)).yieldService();
  }

  function supply(address receiver, uint256 amount) external nonReentrant {
    address _sender = _msgSender();

    yieldService.token().transferFrom(_sender, address(this), amount);
    ensureYieldServiceApproved(amount);
    yieldService.supply(amount);

    _mintSponsorship(receiver, amount);

    emit SponsorshipSupplied(_sender, receiver, amount);
  }

  function redeem(uint256 amount) external nonReentrant {
    address _sender = _msgSender();

    yieldService.redeem(amount);
    IERC20(yieldService.token()).transfer(_sender, amount);

    _burnSponsorship(_sender, amount);

    emit SponsorshipRedeemed(_sender, _sender, amount);
  }

  function operatorRedeem(address from, uint256 amount) external nonReentrant onlyOperator(from) {
    address _sender = _msgSender();

    yieldService.redeem(amount);
    IERC20(yieldService.token()).transfer(from, amount);

    _burnSponsorship(from, amount);

    emit SponsorshipRedeemed(_sender, from, amount);
  }

  function mint(
    address account,
    uint256 amount
  ) external virtual onlyManagerOrModule {
    _mintSponsorship(account, amount);
  }

  function burn(
    address from,
    uint256 amount
  ) external virtual onlyManagerOrModule {
    _burnSponsorship(from, amount);
  }

  function sweep(address[] calldata users) external {
    _sweep(users);
  }



  function _mintSponsorship(
    address account,
    uint256 amount
  ) internal {
    _mint(account, amount, "", "");
    uint256 shares = PrizePoolModuleManager(address(manager)).interestTracker().supplyCollateral(amount);
    interestShares[account] = interestShares[account].add(shares);
  }


  function _burnSponsorship(
    address from,
    uint256 amount
  ) internal {
    _burn(from, amount, "", "");
    uint256 shares = PrizePoolModuleManager(address(manager)).interestTracker().redeemCollateral(amount);
    interestShares[from] = interestShares[from].sub(shares);
    _sweep(from);
  }


  function _sweep(address user) internal {
    address[] memory users = new address[](1);
    users[0] = user;
    _sweep(users);
  }

  function _sweep(address[] memory users) internal {
    InterestTrackerInterface interestTracker = PrizePoolModuleManager(address(manager)).interestTracker();
    Credit sponsorshipCredit = PrizePoolModuleManager(address(manager)).sponsorshipCredit();
    uint256 exchangeRateMantissa = interestTracker.exchangeRateMantissa();
    for (uint256 i = 0; i < users.length; i++) {
      address user = users[i];
      // uint256 collateral = interestTracker.collateralValueOfShares(interestShares[user]);
      uint256 collateral = FixedPoint.divideUintByMantissa(interestShares[user], exchangeRateMantissa);
      uint256 interest = collateral.sub(balanceOf(user));
      sponsorshipCredit.mint(user, interest);
      uint256 shares = interestTracker.redeemCollateral(interest);
      interestShares[user] = interestShares[user].sub(shares);
    }
  }

  function ensureYieldServiceApproved(uint256 amount) internal {
    IERC20 token = yieldService.token();
    if (token.allowance(address(this), address(yieldService)) < amount) {
      yieldService.token().approve(address(yieldService), uint(-1));
    }
  }

  function hashName() public view override returns (bytes32) {
    return Constants.SPONSORSHIP_INTERFACE_HASH;
  }
}
