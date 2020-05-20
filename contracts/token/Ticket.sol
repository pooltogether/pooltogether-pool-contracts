pragma solidity 0.6.4;

import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/uniform-random-number/contracts/UniformRandomNumber.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@nomiclabs/buidler/console.sol";

import "./Meta777.sol";
import "./ControlledToken.sol";
import "../prize-pool/PrizePoolInterface.sol";
import "./TokenControllerInterface.sol";
import "../util/ERC1820Constants.sol";
import "../base/NamedModule.sol";
import "../yield-service/YieldServiceInterface.sol";

/* solium-disable security/no-block-members */
contract Ticket is Meta777, TokenControllerInterface, IERC777Recipient, NamedModule {
  using SortitionSumTreeFactory for SortitionSumTreeFactory.SortitionSumTrees;

  SortitionSumTreeFactory.SortitionSumTrees sortitionSumTrees;
  ControlledToken public timelock;

  mapping(address => uint256) unlockTimestamps;

  bytes32 constant private TREE_KEY = keccak256("PoolTogether/Ticket");
  uint256 constant private MAX_TREE_LEAVES = 5;

  function initialize (
    ModuleManager _manager,
    string memory _name,
    string memory _symbol,
    ControlledToken _timelock,
    address _trustedForwarder
  ) public initializer {
    require(address(_timelock) != address(0), "timelock must not be zero");
    require(address(_timelock.controller()) == address(this), "timelock controller does not match");
    setManager(_manager);
    enableInterface();
    super.initialize(_name, _symbol, _trustedForwarder);
    sortitionSumTrees.createTree(TREE_KEY, MAX_TREE_LEAVES);
    timelock = _timelock;
    ERC1820Constants.REGISTRY.setInterfaceImplementer(address(this), ERC1820Constants.TOKEN_CONTROLLER_INTERFACE_HASH, address(this));
    ERC1820Constants.REGISTRY.setInterfaceImplementer(address(this), ERC1820Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
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
    _transferAndMint(_msgSender(), amount);
  }

  function operatorMintTickets(address to, uint256 amount) external nonReentrant {
    _transferAndMint(to, amount);
  }

  function mintTicketsWithTimelock(uint256 amount) external {
    // Subtract timelocked funds
    timelock.burn(_msgSender(), amount);

    // Mint tickets
    _mint(_msgSender(), amount);
  }

  function _transferAndMint(address to, uint256 amount) internal {
    yieldService().supply(_msgSender(), amount);
    // Mint tickets
    _mint(to, amount);
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
    super._beforeTokenTransfer(operator, from, to, tokenAmount);
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
    _burn(_msgSender(), tickets);

    // redeem the collateral
    yieldService().redeem(address(this), tickets);

    // transfer tickets less fee
    uint256 balance = tickets.sub(exitFee);
    IERC20(prizePool().token()).transfer(_msgSender(), balance);

    // return the amount that was transferred
    return balance;
  }

  function redeemTicketsWithTimelock(uint256 tickets) external nonReentrant returns (uint256) {
    // burn the tickets
    address sender = _msgSender();
    _burn(sender, tickets);

    uint256 unlockTimestamp = prizePool().calculateUnlockTimestamp(sender, tickets);
    uint256 transferChange;

    // See if we need to sweep the old balance
    uint256 balance = timelock.balanceOf(sender);
    if (unlockTimestamps[sender] <= block.timestamp && balance > 0) {
      transferChange = balance;
      timelock.burn(sender, balance);
    }

    // if we are locking these funds for the future
    if (unlockTimestamp > block.timestamp) {
      // time lock new tokens
      timelock.mint(sender, tickets);
      unlockTimestamps[sender] = unlockTimestamp;
    } else { // add funds to change
      transferChange = transferChange.add(tickets);
    }

    // if there is change, withdraw the change and transfer
    if (transferChange > 0) {
      yieldService().redeem(sender, transferChange);
    }

    // return the block at which the funds will be available
    return unlockTimestamp;
  }

  function timelockBalanceAvailableAt(address user) external view returns (uint256) {
    return unlockTimestamps[user];
  }

  function sweepTimelock(address[] calldata users) external nonReentrant returns (uint256) {
    uint256 totalWithdrawal;

    // first gather the total withdrawal and fee
    uint256 i;
    for (i = 0; i < users.length; i++) {
      address user = users[i];
      if (unlockTimestamps[user] <= block.timestamp) {
        totalWithdrawal = totalWithdrawal.add(timelock.balanceOf(user));
        // console.log("sweepTimelock: totalWithdrawal %s", totalWithdrawal);
      }
    }

    // pull out the collateral
    if (totalWithdrawal > 0) {
      // console.log("sweepTimelock: redeemsponsorship %s", totalWithdrawal);
      // console.log("sweepTimelock: redeemsponsorship balance %s", outbalance);
      yieldService().redeem(address(this), totalWithdrawal);
    }

    // console.log("sweepTimelock: starting burn...");
    for (i = 0; i < users.length; i++) {
      address user = users[i];
      if (unlockTimestamps[user] <= block.timestamp) {
        uint256 balance = timelock.balanceOf(user);
        if (balance > 0) {
          // console.log("sweepTimelock: Burning %s", balance);
          timelock.burn(user, balance);
          IERC20(prizePool().token()).transfer(user, balance);
        }
      }
    }
  }

  function beforeTokenTransfer(address, address from, address to, uint256) external override {
    if (
      _msgSender() == address(timelock)
    ) {
      require(from == address(0) || to == address(0), "only minting or burning is allowed");
    }
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
    _mint(to, amount);
  }

  function tokensReceived(
    address operator,
    address from,
    address to,
    uint256 amount,
    bytes calldata userData,
    bytes calldata operatorData
  ) external override {
    // If we have been transferred sponsorship by someone else
    if (
      _msgSender() == address(prizePool().sponsorship()) &&
      operator != address(this) && // we didn't do it
      from != address(0) &&
      from != address(this)
    ) {
      // console.log("TOKENS RECEEEIVED");
      _mintTicketsWithSponsorship(from, amount);
    }
  }

  function yieldService() public view returns (YieldServiceInterface) {
    return YieldServiceInterface(getInterfaceImplementer(ERC1820Constants.YIELD_SERVICE_INTERFACE_HASH));
  }

  function prizePool() public view returns (PrizePoolInterface) {
    return PrizePoolInterface(address(manager));
  }
}
