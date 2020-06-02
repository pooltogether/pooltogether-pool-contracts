pragma solidity 0.6.4;

import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/uniform-random-number/contracts/UniformRandomNumber.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@nomiclabs/buidler/console.sol";

import "../../Constants.sol";
import "../../base/TokenModule.sol";
import "../timelock/Timelock.sol";
import "../loyalty/Loyalty.sol";
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

  YieldServiceInterface yieldService;
  Loyalty loyalty;

  function initialize (
    ModuleManager _manager,
    address _trustedForwarder,
    string memory _name,
    string memory _symbol,
    address[] memory defaultOperators
  ) public override initializer {
    TokenModule.initialize(_manager, _trustedForwarder, _name, _symbol, defaultOperators);
    __ReentrancyGuard_init();
    sortitionSumTrees.createTree(TREE_KEY, MAX_TREE_LEAVES);
    yieldService = YieldServiceInterface(getInterfaceImplementer(Constants.YIELD_SERVICE_INTERFACE_HASH));
    loyalty = Loyalty(getInterfaceImplementer(Constants.LOYALTY_INTERFACE_HASH));
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
    yieldService.token().transferFrom(_msgSender(), address(this), amount);
    ensureYieldServiceApproved(amount);
    yieldService.supply(address(this), amount);
    // Mint tickets
    _mint(to, amount, data, operatorData);
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

  function operatorRedeemTicketsInstantly(
    address from,
    uint256 tickets,
    bytes calldata data,
    bytes calldata operatorData
  ) external nonReentrant onlyOperator(from) returns (uint256) {
    uint256 exitFee = prizePool().calculateExitFee(from, tickets);

    // transfer the fee to this contract
    yieldService.token().transferFrom(_msgSender(), address(this), exitFee);

    // burn the tickets
    _burn(_msgSender(), tickets, "", "");
    // burn the loyalty
    loyalty.redeem(_msgSender(), tickets);

    // redeem the tickets less the fee
    yieldService.redeem(address(this), tickets.sub(exitFee));

    // transfer tickets
    IERC20(yieldService.token()).transfer(from, tickets);

    emit TicketsRedeemedInstantly(_msgSender(), from, tickets, exitFee, data, operatorData);

    // return the exit fee
    return exitFee;
  }

  function redeemTicketsInstantly(uint256 tickets, bytes calldata data) external nonReentrant returns (uint256) {
    address sender = _msgSender();
    uint256 exitFee = prizePool().calculateExitFee(sender, tickets);

    // burn the tickets
    _burn(sender, tickets, "", "");
    // burn the loyalty
    loyalty.redeem(sender, tickets);

    uint256 ticketsLessFee = tickets.sub(exitFee);

    // redeem the collateral less the fee
    yieldService.redeem(address(this), ticketsLessFee);

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
    _burn(sender, tickets, "", "");

    uint256 unlockTimestamp = prizePool().calculateUnlockTimestamp(sender, tickets);
    uint256 transferChange;

    Timelock timelock = getTimelock();

    // See if we need to sweep the old balance
    uint256 balance = timelock.balanceOf(sender);
    if (balance > 0 && timelock.balanceAvailableAt(sender) <= block.timestamp) {
      transferChange = balance;
      timelock.burnFrom(sender, balance);
      // console.log("burning timelock");
    }

    // if we are locking these funds for the future
    if (unlockTimestamp > block.timestamp) {
      // time lock new tokens
      timelock.mintTo(sender, tickets, unlockTimestamp);
      // console.log("minting timelock %s %s", tickets, unlockTimestamp);
    } else { // add funds to change
      transferChange = transferChange.add(tickets);
    }

    // if there is change, withdraw the change and transfer
    if (transferChange > 0) {
      // console.log("withdraw change %s", transferChange);
      yieldService.redeem(sender, transferChange);
    }

    emit TicketsRedeemedWithTimelock(operator, sender, tickets, unlockTimestamp, data, operatorData);

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

  function ensureYieldServiceApproved(uint256 amount) internal {
    IERC20 token = yieldService.token();
    if (token.allowance(address(this), address(yieldService)) < amount) {
      yieldService.token().approve(address(yieldService), uint(-1));
    }
  }

  function prizePool() public view returns (PeriodicPrizePoolInterface) {
    return PeriodicPrizePoolInterface(getInterfaceImplementer(Constants.PRIZE_POOL_INTERFACE_HASH));
  }

  function getTimelock() public view returns (Timelock) {
    return Timelock(getInterfaceImplementer(Constants.TIMELOCK_INTERFACE_HASH));
  }

  modifier onlyOperator(address user) {
    require(isOperatorFor(_msgSender(), user), "ERC777: caller is not an operator for holder");
    _;
  }
}
