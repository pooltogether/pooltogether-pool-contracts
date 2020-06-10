pragma solidity 0.6.4;

import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/uniform-random-number/contracts/UniformRandomNumber.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@nomiclabs/buidler/console.sol";

import "../../module-manager/PrizePoolModuleManager.sol";
import "../../Constants.sol";
import "../../base/TokenModule.sol";
import "../timelock/Timelock.sol";
import "../interest-tracker/InterestTrackerInterface.sol";
import "../periodic-prize-pool/PeriodicPrizePoolInterface.sol";
import "../yield-service/YieldServiceInterface.sol";

/* solium-disable security/no-block-members */
contract Ticket is TokenModule, ReentrancyGuardUpgradeSafe {
  using SortitionSumTreeFactory for SortitionSumTreeFactory.SortitionSumTrees;

  SortitionSumTreeFactory.SortitionSumTrees sortitionSumTrees;

  bytes32 constant private TREE_KEY = keccak256("PoolTogether/Ticket");
  uint256 constant private MAX_TREE_LEAVES = 5;

  event TicketsRedeemedWithTimelock(
    address indexed operator,
    address indexed from,
    uint256 tickets,
    uint256 unlockTimestamp,
    bytes data,
    bytes operatorData
  );

  event TicketsRedeemedInstantly(
    address indexed operator,
    address indexed from,
    uint256 tickets,
    uint256 exitFee,
    bytes data,
    bytes operatorData
  );

  function initialize (
    NamedModuleManager _manager,
    address _trustedForwarder,
    string memory _name,
    string memory _symbol,
    address[] memory defaultOperators
  ) public override initializer {
    TokenModule.initialize(_manager, _trustedForwarder, _name, _symbol, defaultOperators);
    __ReentrancyGuard_init();
    sortitionSumTrees.createTree(TREE_KEY, MAX_TREE_LEAVES);
  }

  function hashName() public view override returns (bytes32) {
    return Constants.TICKET_INTERFACE_HASH;
  }

  function mintTickets(uint256 amount, bytes calldata data) external nonReentrant {
    _supplyAndMint(_msgSender(), amount, data, "");
  }

  function operatorMintTickets(address to, uint256 amount, bytes calldata data, bytes calldata operatorData) external nonReentrant {
    _supplyAndMint(to, amount, data, operatorData);
  }

  function _supplyAndMint(address to, uint256 amount, bytes memory data, bytes memory operatorData) internal {
    YieldServiceInterface yieldService = PrizePoolModuleManager(address(manager)).yieldService();

    console.log("setp 1");
    yieldService.token().transferFrom(_msgSender(), address(this), amount);
    console.log("setp 2");
    ensureYieldServiceApproved(amount);
    console.log("setp 3");
    yieldService.supply(amount);
    console.log("setp 4");
    _mintTickets(to, amount, data, operatorData);
  }

  function _mintTickets(address to, uint256 amount, bytes memory data, bytes memory operatorData) internal {
    // Mint tickets
    _mint(to, amount, data, operatorData);
    console.log("setp 5");
    PrizePoolModuleManager(address(manager)).prizePool().mintedTickets(amount);
    console.log("setp 6");
    PrizePoolModuleManager(address(manager)).interestTracker().supplyCollateral(to, amount);
    console.log("setp 7");
  }

  function draw(uint256 randomNumber) external view returns (address) {
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

  function operatorRedeemTicketsInstantly(
    address from,
    uint256 tickets,
    bytes calldata data,
    bytes calldata operatorData
  ) external nonReentrant onlyOperator(from) returns (uint256) {
    uint256 exitFee = PrizePoolModuleManager(address(manager)).prizePool().calculateExitFee(from, tickets);

    YieldServiceInterface yieldService = PrizePoolModuleManager(address(manager)).yieldService();

    // transfer the fee to this contract
    yieldService.token().transferFrom(_msgSender(), address(this), exitFee);

    // burn the tickets
    _burnTickets(from, tickets);
    // burn the interestTracker
    PrizePoolModuleManager(address(manager)).interestTracker().redeemCollateral(from, tickets);

    // redeem the tickets less the fee
    yieldService.redeem(tickets.sub(exitFee));

    // transfer tickets
    IERC20(yieldService.token()).transfer(from, tickets);

    emit TicketsRedeemedInstantly(_msgSender(), from, tickets, exitFee, data, operatorData);

    // return the exit fee
    return exitFee;
  }

  function redeemTicketsInstantly(uint256 tickets, bytes calldata data) external nonReentrant returns (uint256) {
    address sender = _msgSender();
    uint256 exitFee = PrizePoolModuleManager(address(manager)).prizePool().calculateExitFee(sender, tickets);

    YieldServiceInterface yieldService = PrizePoolModuleManager(address(manager)).yieldService();

    // burn the tickets
    _burnTickets(sender, tickets);

    // burn the interestTracker
    PrizePoolModuleManager(address(manager)).interestTracker().redeemCollateral(sender, tickets);

    uint256 ticketsLessFee = tickets.sub(exitFee);

    // redeem the interestTracker less the fee
    yieldService.redeem(ticketsLessFee);

    // transfer tickets less fee
    IERC20(yieldService.token()).transfer(sender, ticketsLessFee);

    emit TicketsRedeemedInstantly(sender, sender, tickets, exitFee, data, "");

    // return the exit fee
    return exitFee;
  }

  function operatorRedeemTicketsWithTimelock(
    address from,
    uint256 tickets,
    bytes calldata data,
    bytes calldata operatorData
  ) external nonReentrant onlyOperator(from) returns (uint256) {
    return _redeemTicketsWithTimelock(_msgSender(), from, tickets, data, operatorData);
  }

  function redeemTicketsWithTimelock(uint256 tickets, bytes calldata data) external nonReentrant returns (uint256) {
    address sender = _msgSender();
    return _redeemTicketsWithTimelock(sender, sender, tickets, data, "");
  }

  function _redeemTicketsWithTimelock(
    address operator,
    address sender,
    uint256 tickets,
    bytes memory data,
    bytes memory operatorData
  ) internal returns (uint256) {
    // burn the tickets
    require(balanceOf(sender) >= tickets, "Insufficient balance");
    _burnTickets(sender, tickets);

    uint256 unlockTimestamp = PrizePoolModuleManager(address(manager)).prizePool().calculateUnlockTimestamp(sender, tickets);

    Timelock timelock = PrizePoolModuleManager(address(manager)).timelock();

    // Sweep the old balance, if any
    address[] memory senders = new address[](1);
    senders[0] = sender;
    timelock.sweep(senders);

    timelock.mintTo(sender, tickets, unlockTimestamp);

    emit TicketsRedeemedWithTimelock(operator, sender, tickets, unlockTimestamp, data, operatorData);

    // if the funds should already be unlocked
    if (unlockTimestamp <= block.timestamp) {
      timelock.sweep(senders);
    }

    // return the block at which the funds will be available
    return unlockTimestamp;
  }

  function _burnTickets(address from, uint256 tickets) internal {
    _burn(from, tickets, "", "");
    PrizePoolModuleManager(address(manager)).prizePool().redeemedTickets(tickets);
  }

  function mintTicketsWithSponsorshipTo(address to, uint256 amount) external {
    _mintTicketsWithSponsorship(to, amount);
  }

  function _mintTicketsWithSponsorship(address to, uint256 amount) internal {
    // console.log("_mintTicketsWithSponsorship: transferfrom: %s", amount);
    // Transfer sponsorship
    PrizePoolModuleManager(address(manager)).sponsorship().transferFrom(_msgSender(), address(this), amount);

    // console.log("_mintTicketsWithSponsorship: minting...", amount);
    // Mint draws
    _mintTickets(to, amount, "", "");
  }

  function ensureYieldServiceApproved(uint256 amount) internal {
    YieldServiceInterface yieldService = PrizePoolModuleManager(address(manager)).yieldService();
    IERC20 token = yieldService.token();
    if (token.allowance(address(this), address(yieldService)) < amount) {
      yieldService.token().approve(address(yieldService), uint(-1));
    }
  }

  modifier onlyOperator(address user) {
    require(isOperatorFor(_msgSender(), user), "ERC777: caller is not an operator for holder");
    _;
  }
}
