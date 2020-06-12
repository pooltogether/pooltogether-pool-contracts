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

  mapping(address => uint256) interestShares;

  InterestTrackerInterface public interestTracker;
  PeriodicPrizePoolInterface public prizePool;
  YieldServiceInterface public yieldService;
  Timelock public timelock;
  Credit public ticketCredit;

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

  function initializeDependencies() external {
    require(address(prizePool) == address(0), "dependencies already initialized");
    PrizePoolModuleManager pManager = PrizePoolModuleManager(address(manager));
    prizePool = pManager.prizePool();
    yieldService = pManager.yieldService();
    interestTracker = pManager.interestTracker();
    timelock = pManager.timelock();
    ticketCredit = pManager.ticketCredit();
  }

  function hashName() public view override returns (bytes32) {
    return Constants.TICKET_INTERFACE_HASH;
  }

  function mintTickets(address to, uint256 amount, bytes calldata data) external nonReentrant {
    // console.log("mintTickets: %s %s %s", _msgSender(), to, amount);
    yieldService.token().transferFrom(_msgSender(), address(this), amount);
    ensureYieldServiceApproved(amount);
    yieldService.supply(amount);
    _mintTickets(to, amount, data, "");
    prizePool.mintedTickets(amount);
  }

  function _mintTickets(address to, uint256 amount, bytes memory data, bytes memory operatorData) internal {
    // Mint tickets
    _mint(to, amount, data, operatorData);
    uint256 shares = interestTracker.supplyCollateral(amount);
    // console.log("share: %s", shares);
    interestShares[to] = interestShares[to].add(shares);
    // console.log("final shares: %s", interestShares[to]);
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
    uint256 userInterestRatioMantissa = _interestRatioMantissa(from);
    uint256 exitFee = prizePool.calculateExitFee(tickets, userInterestRatioMantissa);

    // transfer the fee to this contract
    yieldService.token().transferFrom(_msgSender(), address(this), exitFee);

    // burn the tickets
    _burnTickets(from, tickets);
    // burn the interestTracker
    _creditUser(from, tickets, userInterestRatioMantissa);

    // redeem the tickets less the fee
    yieldService.redeem(tickets.sub(exitFee));

    // transfer tickets
    IERC20(yieldService.token()).transfer(from, tickets);

    emit TicketsRedeemedInstantly(_msgSender(), from, tickets, exitFee, data, operatorData);

    // return the exit fee
    return exitFee;
  }

  function interestRatioMantissa(address user) external returns (uint256) {
    return _interestRatioMantissa(user);
  }

  function _interestRatioMantissa(address user) internal returns (uint256) {
    uint256 tickets = balanceOf(user);
    // console.log("_interestRatioMantissa %s %s %s", user, tickets, interestShares[user]);
    uint256 ticketsPlusInterest = interestTracker.collateralValueOfShares(interestShares[user]);
    // console.log("_interestRatioMantissa ticketsPlusInterest %s %s", ticketsPlusInterest, tickets);
    uint256 interest;
    if (ticketsPlusInterest >= tickets) {
      interest = ticketsPlusInterest.sub(tickets);
    }
    // console.log("????????????? interest %s", interest);
    return FixedPoint.calculateMantissa(interest, tickets);
  }

  function redeemTicketsInstantly(uint256 tickets, bytes calldata data) external nonReentrant returns (uint256) {
    // console.log("redeemTicketsInstantly!!!");
    address sender = _msgSender();
    uint256 userInterestRatioMantissa = _interestRatioMantissa(sender);

    // console.log("redeemTicketsInstantly: userInterestRatioMantissa: %s", userInterestRatioMantissa);

    uint256 exitFee = prizePool.calculateExitFee(
      tickets,
      userInterestRatioMantissa
    );

    // console.log("redeemTicketsInstantly: exitFee: %s", exitFee);

    // console.log("redeemTicketsInstantly: burning...");

    // burn the tickets
    _burnTickets(sender, tickets);

    // console.log("redeemTicketsInstantly: crediting...");

    // now calculate how much interest needs to be redeemed to maintain the interest ratio
    _creditUser(sender, tickets, userInterestRatioMantissa);

    uint256 ticketsLessFee = tickets.sub(exitFee);

    // console.log("redeemTicketsInstantly: ticketsLessFee: %s", ticketsLessFee);

    // redeem the interestTracker less the fee
    yieldService.redeem(ticketsLessFee);

    // transfer tickets less fee
    IERC20(yieldService.token()).transfer(sender, ticketsLessFee);

    emit TicketsRedeemedInstantly(sender, sender, tickets, exitFee, data, "");

    // return the exit fee
    return exitFee;
  }

  function _creditUser(address sender, uint256 tickets, uint256 userInterestRatioMantissa) internal {
    uint256 ticketInterest = FixedPoint.multiplyUintByMantissa(tickets, userInterestRatioMantissa);
    // console.log("_creditUser ticketInterest: %s", ticketInterest);
    uint256 burnedShares = interestTracker.redeemCollateral(tickets.add(ticketInterest));
    // console.log("_creditUser burnedShares: %s", burnedShares);
    interestShares[sender] = interestShares[sender].sub(burnedShares);
    // console.log("_creditUser new shares: %s", interestShares[sender]);
    ticketCredit.mint(sender, ticketInterest);
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

    uint256 unlockTimestamp = prizePool.calculateUnlockTimestamp(sender, tickets);

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
    prizePool.redeemedTickets(tickets);
  }

  function mintTicketsWithSponsorshipTo(address to, uint256 amount) external {
    _mintTicketsWithSponsorship(to, amount);
  }

  function _mintTicketsWithSponsorship(address to, uint256 amount) internal {
    // Transfer sponsorship
    PrizePoolModuleManager(address(manager)).sponsorship().transferFrom(_msgSender(), address(this), amount);

    // Mint draws
    _mintTickets(to, amount, "", "");
  }

  function ensureYieldServiceApproved(uint256 amount) internal {
    IERC20 token = yieldService.token();
    if (token.allowance(address(this), address(yieldService)) < amount) {
      yieldService.token().approve(address(yieldService), uint(-1));
    }
  }

  function balanceOfInterestShares(address user) external view returns (uint256) {
    return interestShares[user];
  }

  modifier onlyOperator(address user) {
    require(isOperatorFor(_msgSender(), user), "ERC777: caller is not an operator for holder");
    _;
  }
}
