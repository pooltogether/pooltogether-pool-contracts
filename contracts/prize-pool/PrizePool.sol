pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@nomiclabs/buidler/console.sol";

import "./AbstractYieldService.sol";
import "./ComptrollerInterface.sol";
import "../token/ControlledToken.sol";
import "../token/TokenControllerInterface.sol";

/* solium-disable security/no-block-members */
abstract contract PrizePool is Initializable, AbstractYieldService, BaseRelayRecipient, ReentrancyGuardUpgradeSafe, TokenControllerInterface {
  using SafeMath for uint256;

  struct BalanceChange {
    address user;
    uint256 balance;
  }

  event CapturedAward(uint256 amount);
  event Deposited(address indexed operator, address indexed to, address indexed token, uint256 amount);
  event Awarded(address indexed winner, address indexed token, uint256 amount);
  event InstantWithdrawal(address indexed operator, address indexed from, address indexed token, uint256 amount, uint256 exitFee, uint256 sponsoredExitFee);
  event TimelockedWithdrawal(address indexed operator, address indexed from, address indexed token, uint256 amount, uint256 unlockTimestamp);
  event TimelockedWithdrawalSwept(address indexed operator, address indexed from, uint256 amount);

  address internal constant SENTINAL_TOKEN = address(0x1);

  mapping(address => address) internal _tokens;
  uint256 tokenCount;
  ComptrollerInterface public comptroller;
  ControlledToken public timelock;
  
  uint256 public timelockTotalSupply;
  mapping(address => uint256) internal timelockBalances;
  mapping(address => uint256) internal unlockTimestamps;

  uint256 internal __awardBalance;

  struct InterestIndex {
    uint224 mantissa;
    uint32 blockNumber;
  }

  InterestIndex internal interestIndex;

  function initialize (
    address _trustedForwarder,
    ComptrollerInterface _comptroller,
    ControlledToken[] memory _collateralTokens
  ) public initializer {
    require(address(_comptroller) != address(0), "PrizePool/comptroller-zero");
    require(_trustedForwarder != address(0), "PrizePool/forwarder-zero");
    interestIndex = InterestIndex({
      mantissa: uint224(1 ether),
      blockNumber: uint32(block.number)
    });
    tokenCount = 1;
    _tokens[SENTINAL_TOKEN] = SENTINAL_TOKEN;
    for (uint256 i = 0; i < _collateralTokens.length; i++) {
      _tokens[address(_collateralTokens[i])] = _tokens[SENTINAL_TOKEN];
      _tokens[SENTINAL_TOKEN] = address(_collateralTokens[i]);
      tokenCount += 1;
      require(_collateralTokens[i].controller() == this, "PrizePool/token-ctrlr-mismatch");
    }
    __ReentrancyGuard_init();
    trustedForwarder = _trustedForwarder;
    comptroller = _comptroller;
  }

  function depositTo(address to, uint256 amount, address token) external onlyControlledToken(token) nonReentrant {
    _updateAwardBalance();

    address operator = _msgSender();

    ControlledToken(token).controllerMint(to, amount);
    _token().transferFrom(operator, address(this), amount);
    _supply(amount);

    comptroller.afterDepositTo(to, amount, token);

    emit Deposited(operator, to, token, amount);
  }

  function withdrawInstantlyFrom(
    address from,
    uint256 amount,
    address token,
    uint256 prepaidExitFee
  )
    external nonReentrant onlyControlledToken(token) returns (uint256)
  {
    _updateAwardBalance();

    address operator = _msgSender();
    uint256 exitFee = comptroller.calculateInstantWithdrawalFee(from, amount, token);
    uint256 sponsoredExitFee = (exitFee > prepaidExitFee) ? prepaidExitFee : exitFee;
    uint256 userExitFee = exitFee.sub(sponsoredExitFee);

    if (sponsoredExitFee > 0) {
      // transfer the fee to this contract
      _token().transferFrom(operator, address(this), sponsoredExitFee);
    }

    // burn the tickets
    ControlledToken(token).controllerBurnFrom(_msgSender(), from, amount);

    // redeem the tickets less the fee
    uint256 amountLessFee = amount.sub(userExitFee);
    _redeem(amountLessFee);
    _token().transfer(from, amountLessFee);

    comptroller.afterWithdrawInstantlyFrom(operator, from, amount, token, exitFee, sponsoredExitFee);

    emit InstantWithdrawal(operator, from, token, amount, exitFee, sponsoredExitFee);

    // return the exit fee
    return exitFee;
  }

  function withdrawWithTimelockFrom(
    address from,
    uint256 amount,
    address token
  )
    external nonReentrant onlyControlledToken(token) returns (uint256)
  {
    _updateAwardBalance();


    address operator = _msgSender();

    ControlledToken(token).controllerBurnFrom(operator, from, amount);

    // Sweep the old balance, if any
    address[] memory users = new address[](1);
    users[0] = from;


    sweepTimelockBalances(users);


    timelockTotalSupply = timelockTotalSupply.add(amount);
    timelockBalances[from] = timelockBalances[from].add(amount);

    uint256 unlockTimestamp = comptroller.calculateWithdrawalUnlockTimestamp(from, amount, token);
    unlockTimestamps[from] = unlockTimestamp;


    comptroller.afterWithdrawWithTimelockFrom(from, amount, token);

    emit TimelockedWithdrawal(operator, from, token, amount, unlockTimestamp);


    // if the funds should already be unlocked
    if (unlockTimestamp <= _currentTime()) {
      sweepTimelockBalances(users);
    }

    // return the block at which the funds will be available
    return unlockTimestamp;
  }

  function beforeTokenTransfer(address from, address to, uint256 amount) external override {
    // minting and redeeming are handled separately
    if (from != address(0) && to != address(0)) {
      comptroller.beforeTokenTransfer(from, to, amount, msg.sender);
    }
  }

  function awardBalance() external returns (uint256) {
    _updateAwardBalance();
    return __awardBalance;
  }

  // The index is the accrued interest on the collateral since the last update.
  // however, do we include the current interest?

  function _updateAwardBalance() internal {
    // this should only run once per block.
    if (interestIndex.blockNumber == uint32(block.number)) {
      return;
    }

    uint256 tokenTotalSupply = _tokenTotalSupply();
    uint256 bal = _balance();
    uint256 accounted = tokenTotalSupply.add(__awardBalance);

    if (bal < accounted) {
      // if the balance is less then the accounted, we must decrease the prize.
      uint256 diff = accounted.sub(bal);
      __awardBalance = __awardBalance.sub(diff);
    } else if (bal > accounted) {
    // if the balance is greater then the accounted, we capture it as prize money
     uint256 diff = bal.sub(accounted);
      __awardBalance = __awardBalance.add(diff);
    }

    if (accounted > 0) {
      interestIndex = InterestIndex({
        mantissa: uint224(interestIndex.mantissa * bal / accounted),
        blockNumber: uint32(block.number)
      });
    }
  }

  function interestIndexMantissa() external returns (uint256) {
    _updateAwardBalance();
    return uint256(interestIndex.mantissa);
  }

  function award(address to, uint256 amount, address token) external onlyComptroller onlyControlledToken(token) {
    _updateAwardBalance();
    ControlledToken(token).controllerMint(to, amount);
    __awardBalance = __awardBalance.sub(amount);

    emit Awarded(to, token, amount);
  }

  function sweepTimelockBalances(address[] memory users) public returns (uint256) {
    address operator = _msgSender();

    uint256 totalWithdrawal;
    // first gather the total withdrawal and fee
    uint256 i;
    for (i = 0; i < users.length; i++) {
      address user = users[i];
      if (unlockTimestamps[user] <= _currentTime()) {
        totalWithdrawal = totalWithdrawal.add(timelockBalances[user]);
      }
    }

    // if there is nothing to do, just quit
    if (totalWithdrawal == 0) {
      return 0;
    }
    

    _redeem(totalWithdrawal);

    BalanceChange[] memory changes = new BalanceChange[](users.length);

    IERC20 token = IERC20(_token());
    for (i = 0; i < users.length; i++) {
      address user = users[i];
      if (unlockTimestamps[user] <= _currentTime()) {
        uint256 balance = timelockBalances[user];
        if (balance > 0) {
          timelockTotalSupply = timelockTotalSupply.sub(balance);
          delete timelockBalances[user];
          delete unlockTimestamps[user];
          token.transfer(user, balance);
          emit TimelockedWithdrawalSwept(operator, user, balance);
        }
        changes[i] = BalanceChange(user, balance);
      } else {
        changes[i] = BalanceChange(user, 0);
      }
    }

    for (i = 0; i < changes.length; i++) {
      BalanceChange memory change = changes[i];
      if (change.balance > 0) {
        comptroller.afterSweepTimelockedWithdrawal(operator, change.user, change.balance);
      }
    }
  }

  function tokens() external view returns (address[] memory) {
    address[] memory array = new address[](tokenCount);
    uint256 count;
    address currentToken = _tokens[SENTINAL_TOKEN];
    while (currentToken != address(0) && currentToken != SENTINAL_TOKEN) {
      array[count] = currentToken;
      currentToken = _tokens[currentToken];
      count++;
    }
    return array;
  }

  function _currentTime() internal virtual view returns (uint256) {
    return block.timestamp;
  }

  function timelockBalanceAvailableAt(address user) external view returns (uint256) {
    return unlockTimestamps[user];
  }

  function timelockBalanceOf(address user) external view returns (uint256) {
    return timelockBalances[user];
  }

  function accountedBalance() external view returns (uint256) {
    return _tokenTotalSupply();
  }

  function _tokenTotalSupply() internal view returns (uint256) {
    uint256 total = timelockTotalSupply;
    address currentToken = _tokens[SENTINAL_TOKEN];
    while (currentToken != address(0) && currentToken != SENTINAL_TOKEN) {
      total = IERC20(currentToken).totalSupply();
      currentToken = _tokens[currentToken];
    }
    return total;
  }
  
  modifier onlyControlledToken(address _token) {
    require(_token != address(0) && _tokens[_token] != address(0), "PrizePool/unknown-token");
    _;
  }

  modifier onlyComptroller() {
    require(msg.sender == address(comptroller), "PrizePool/only-comptroller");
    _;
  }
}
