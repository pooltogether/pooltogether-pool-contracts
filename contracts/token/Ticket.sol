pragma solidity 0.6.4;

import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/uniform-random-number/contracts/UniformRandomNumber.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@nomiclabs/buidler/console.sol";

import "./Meta777.sol";
import "./Timelock.sol";
import "./Loyalty.sol";
import "../prize-pool/PrizePoolInterface.sol";
import "./TokenControllerInterface.sol";
import "../util/ERC1820Constants.sol";
import "../base/NamedModule.sol";
import "../yield-service/YieldServiceInterface.sol";

/* solium-disable security/no-block-members */
contract Ticket is Meta777, NamedModule {
  using SortitionSumTreeFactory for SortitionSumTreeFactory.SortitionSumTrees;

  SortitionSumTreeFactory.SortitionSumTrees sortitionSumTrees;

  bytes32 constant private TREE_KEY = keccak256("PoolTogether/Ticket");
  uint256 constant private MAX_TREE_LEAVES = 5;

  YieldServiceInterface yieldService;
  Loyalty loyalty;

  function initialize (
    ModuleManager _manager,
    string memory _name,
    string memory _symbol,
    address _trustedForwarder
  ) public initializer {
    setManager(_manager);
    enableInterface();
    super.initialize(_name, _symbol, _trustedForwarder);
    sortitionSumTrees.createTree(TREE_KEY, MAX_TREE_LEAVES);
    yieldService = YieldServiceInterface(getInterfaceImplementer(ERC1820Constants.YIELD_SERVICE_INTERFACE_HASH));
    loyalty = Loyalty(getInterfaceImplementer(ERC1820Constants.LOYALTY_INTERFACE_HASH));
    yieldService.token().approve(address(yieldService), uint(-1));
  }

  function hashName() public view override returns (bytes32) {
    return ERC1820Constants.TICKET_INTERFACE_HASH;
  }

  function calculateExitFee(address, uint256 tickets) public view returns (uint256) {
    uint256 totalSupply = totalSupply();
    if (totalSupply == 0) {
      return 0;
    }
    return FixedPoint.multiplyUintByMantissa(
      prizePool().calculateRemainingPreviousPrize(),
      FixedPoint.calculateMantissa(tickets, totalSupply)
    );
  }

  function mintTickets(uint256 amount) external nonReentrant {
    _supplyAndMint(_msgSender(), amount);
  }

  function operatorMintTickets(address to, uint256 amount) external nonReentrant {
    _supplyAndMint(to, amount);
  }

  function mintTicketsWithTimelock(uint256 amount) external {
    // Subtract timelocked funds
    getTimelock().burn(_msgSender(), amount);

    // Mint tickets
    _mint(_msgSender(), amount, "", "");
  }

  function _supplyAndMint(address to, uint256 amount) internal {
    yieldService.token().transferFrom(to, address(this), amount);
    yieldService.supply(address(this), amount);
    // Mint tickets
    _mint(to, amount, "", "");
    loyalty.supply(to, amount);
  }

  function draw(uint256 randomNumber) public view returns (address) {
    uint256 bound = totalSupply();
    address selected;
    if (bound == 0) {
      selected = address(0);
    } else {
      uint256 token = UniformRandomNumber.uniform(randomNumber, bound);
      selected = address(uint256(sortitionSumTrees.draw(TREE_KEY, token)));
    }
    return selected;
  }

  function _beforeTokenTransfer(address operator, address from, address to, uint256 tokenAmount) internal virtual override {
    if (from != address(0)) {
      uint256 fromBalance = balanceOf(from);
      sortitionSumTrees.set(TREE_KEY, fromBalance.sub(tokenAmount), bytes32(uint256(from)));
    }

    if (to != address(0)) {
      uint256 toBalance = balanceOf(to);
      sortitionSumTrees.set(TREE_KEY, toBalance.add(tokenAmount), bytes32(uint256(to)));
    }
  }

  function redeemTicketsInstantly(uint256 tickets) external nonReentrant returns (uint256) {
    uint256 exitFee = calculateExitFee(_msgSender(), tickets);

    // burn the tickets
    _burn(_msgSender(), tickets, "", "");
    // burn the loyalty
    loyalty.redeem(_msgSender(), tickets);

    // redeem the collateral
    yieldService.redeem(address(this), tickets);

    // transfer tickets less fee
    uint256 balance = tickets.sub(exitFee);
    IERC20(prizePool().token()).transfer(_msgSender(), balance);

    // return the amount that was transferred
    return balance;
  }

  function redeemTicketsWithTimelock(uint256 tickets) external nonReentrant returns (uint256) {
    // burn the tickets
    address sender = _msgSender();
    _burn(sender, tickets, "", "");

    uint256 unlockTimestamp = prizePool().calculateUnlockTimestamp(sender, tickets);
    uint256 transferChange;

    Timelock timelock = getTimelock();

    // See if we need to sweep the old balance
    uint256 balance = timelock.balanceOf(sender);
    if (balance > 0 && timelock.balanceAvailableAt(sender) <= block.timestamp) {
      transferChange = balance;
      timelock.burn(sender, balance);
      // console.log("burning timelock");
    }

    // if we are locking these funds for the future
    if (unlockTimestamp > block.timestamp) {
      // time lock new tokens
      timelock.mint(sender, tickets, unlockTimestamp);
      // console.log("minting timelock %s %s", tickets, unlockTimestamp);
    } else { // add funds to change
      transferChange = transferChange.add(tickets);
    }

    // if there is change, withdraw the change and transfer
    if (transferChange > 0) {
      // console.log("withdraw change %s", transferChange);
      yieldService.redeem(sender, transferChange);
    }

    // return the block at which the funds will be available
    return unlockTimestamp;
  }

  function mintTicketsWithSponsorshipTo(address to, uint256 amount) external {
    _mintTicketsWithSponsorship(to, amount);
  }

  function _mintTicketsWithSponsorship(address to, uint256 amount) internal {
    // console.log("_mintTicketsWithSponsorship: transferfrom: %s", amount);
    // Transfer sponsorship
    prizePool().sponsorship().transferFrom(_msgSender(), address(this), amount);

    // console.log("_mintTicketsWithSponsorship: minting...", amount);
    // Mint draws
    _mint(to, amount, "", "");
  }

  // function loyalty() public view returns (Loyalty) {
  //   return Loyalty(getInterfaceImplementer(ERC1820Constants.LOYALTY_INTERFACE_HASH));
  // }

  // function yieldService() public view returns (YieldServiceInterface) {
  //   return YieldServiceInterface(getInterfaceImplementer(ERC1820Constants.YIELD_SERVICE_INTERFACE_HASH));
  // }

  function prizePool() public view returns (PrizePoolInterface) {
    return PrizePoolInterface(address(manager));
  }

  function getTimelock() public view returns (Timelock) {
    return Timelock(getInterfaceImplementer(ERC1820Constants.TIMELOCK_INTERFACE_HASH));
  }
}
