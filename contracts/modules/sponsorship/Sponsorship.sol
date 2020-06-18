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
  event SponsorshipMinted(address indexed operator, address indexed to, uint256 amount);
  event SponsorshipBurned(address indexed operator, address indexed from, uint256 amount);
  event SponsorshipSwept(address indexed operator, address[] users);

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

  function balanceOfInterestShares(address user) external view returns (uint256) {
    return interestShares[user];
  }

  function supply(address receiver, uint256 amount) external nonReentrant {
    address sender = _msgSender();

    yieldService.token().transferFrom(sender, address(this), amount);
    ensureYieldServiceApproved(amount);
    yieldService.supply(amount);

    _mintSponsorship(receiver, amount);

    emit SponsorshipSupplied(sender, receiver, amount);
  }

  function redeem(uint256 amount) external nonReentrant {
    address sender = _msgSender();
    require(interestShares[sender] >= amount, "Sponsorship/insuff");

    _burnSponsorship(sender, amount);

    yieldService.redeem(amount);
    IERC20(yieldService.token()).transfer(sender, amount);

    emit SponsorshipRedeemed(sender, sender, amount);
  }

  function operatorRedeem(address from, uint256 amount) external nonReentrant onlyOperator(from) {
    address sender = _msgSender();

    _burnSponsorship(from, amount);

    yieldService.redeem(amount);
    IERC20(yieldService.token()).transfer(from, amount);

    emit SponsorshipRedeemed(sender, from, amount);
  }

  function mint(
    address account,
    uint256 amount
  ) external virtual onlyManagerOrModule {
    _mintSponsorship(account, amount);
    emit SponsorshipMinted(_msgSender(), account, amount);
  }

  function burn(
    address account,
    uint256 amount
  ) external virtual onlyManagerOrModule {
    _burnSponsorship(account, amount);
    emit SponsorshipBurned(_msgSender(), account, amount);
  }

  function sweep(address[] calldata users) external {
    _sweep(users);
    emit SponsorshipSwept(_msgSender(), users);
  }

  function _mintSponsorship(
    address account,
    uint256 amount
  ) internal {
    // Mint sponsorship tokens
    _mint(account, amount, "", "");

    // Supply collateral for interest tracking
    uint256 shares = PrizePoolModuleManager(address(manager)).interestTracker().supplyCollateral(amount);
    interestShares[account] = interestShares[account].add(shares);

    // Burn & accredit any accrued interest on collateral
    _sweepInterest(account);
  }

  function _burnSponsorship(
    address account,
    uint256 amount
  ) internal {
    // Burn & accredit accrued interest on collateral
    _burnCollateralSweepInterest(account, amount);

    // Burn sponsorship tokens
    _burn(account, amount, "", "");
  }

  function _burnCollateralSweepInterest(
    address account, 
    uint256 collateralAmount
  ) internal {
    // Burn collateral + interest from interest tracker
    _burnFromInterestTracker(account, collateralAmount.add(_mintCredit(account)));
  }

  function _sweepInterest(address account) internal {
    // Burn interest from interest tracker
    _burnFromInterestTracker(account, _mintCredit(account));
  }

  function _sweep(address[] memory accounts) internal {
    for (uint256 i = 0; i < accounts.length; i++) {
      address account = accounts[i];
      _sweepInterest(account);
    }
  }

  function _calculateCollateralInterest(address account) internal returns (uint256 interest) {
    InterestTrackerInterface interestTracker = PrizePoolModuleManager(address(manager)).interestTracker();
    uint256 exchangeRateMantissa = interestTracker.exchangeRateMantissa();
    
    // Calculate interest on collateral to be accreditted to account
    uint256 collateral = FixedPoint.divideUintByMantissa(interestShares[account], exchangeRateMantissa);
    interest = collateral.sub(balanceOf(account));
  }

  function _burnFromInterestTracker(address account, uint256 amount) internal {
    // Burn collateral/interest from interest tracker
    uint256 shares = PrizePoolModuleManager(address(manager)).interestTracker().redeemCollateral(amount);
    interestShares[account] = interestShares[account].sub(shares);
  }
  
  function _mintCredit(address account) internal returns (uint256 interest) {
    // Calculate any accrued interest on existing collateral
    interest = _calculateCollateralInterest(account);

    // Mint sponsorship credit for interest accrued
    Credit sponsorshipCredit = PrizePoolModuleManager(address(manager)).sponsorshipCredit();
    sponsorshipCredit.mint(account, interest);
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
