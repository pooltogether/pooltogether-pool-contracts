pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "./PrizeStrategyInterface.sol";
import "../token/ControlledToken.sol";
import "../token/TokenControllerInterface.sol";
import "./MappedSinglyLinkedList.sol";

/// @title Base Prize Pool for managing escrowed assets
/// @notice Manages depositing and withdrawing assets from the Prize Pool
/// @dev Must be inherited to provide specific yield-bearing asset control, such as Compound cTokens
abstract contract PrizePool is Initializable, BaseRelayRecipient, ReentrancyGuardUpgradeSafe, TokenControllerInterface {
  using SafeMath for uint256;
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;

  struct BalanceChange {
    address user;
    uint256 balance;
  }

  struct InterestIndex {
    uint224 mantissa;
    uint32 blockNumber;
  }

  event CapturedAward(uint256 amount);
  event Deposited(address indexed operator, address indexed to, address indexed token, uint256 amount);
  event Awarded(address indexed winner, address indexed token, uint256 amount);
  event AwardedExternal(address indexed winner, address indexed token, uint256 amount);
  event InstantWithdrawal(address indexed operator, address indexed from, address indexed token, uint256 amount, uint256 exitFee, uint256 sponsoredExitFee);
  event TimelockedWithdrawal(address indexed operator, address indexed from, address indexed token, uint256 amount, uint256 unlockTimestamp);
  event TimelockedWithdrawalSwept(address indexed operator, address indexed from, uint256 amount);
  event PrincipalSupplied(address from, uint256 amount);
  event PrincipalRedeemed(address from, uint256 amount);

  MappedSinglyLinkedList.Mapping internal _tokens;
  PrizeStrategyInterface public prizeStrategy;

  uint256 public timelockTotalSupply;
  mapping(address => uint256) internal timelockBalances;
  mapping(address => uint256) internal unlockTimestamps;

  uint256 internal __awardBalance;

  InterestIndex internal interestIndex;

  /// @notice Initializes the Prize Pool with required contract connections
  /// @param _trustedForwarder Address of the Forwarding Contract for GSN Meta-Txs
  /// @param _prizeStrategy Address of the component-controller that manages the prize-strategy
  /// @param _controlledTokens Array of addresses for the Ticket and Sponsorship Tokens controlled by the Prize Pool
  function initialize (
    address _trustedForwarder,
    PrizeStrategyInterface _prizeStrategy,
    address[] memory _controlledTokens
  )
    public
    initializer
  {
    require(address(_prizeStrategy) != address(0), "PrizePool/prizeStrategy-zero");
    require(_trustedForwarder != address(0), "PrizePool/forwarder-zero");
    interestIndex = InterestIndex({
      mantissa: uint224(1 ether),
      blockNumber: uint32(block.number)
    });
    _tokens.initialize(_controlledTokens);
    for (uint256 i = 0; i < _controlledTokens.length; i++) {
      require(ControlledToken(_controlledTokens[i]).controller() == this, "PrizePool/token-ctrlr-mismatch");
    }
    __ReentrancyGuard_init();
    trustedForwarder = _trustedForwarder;
    prizeStrategy = _prizeStrategy;
  }

  /// @dev Inheriting contract must determine if a specific token type may be awarded as a prize enhancement
  /// @param _token The address of the token to check
  /// @return True if the token may be awarded, false otherwise
  function _canAwardExternal(address _token) internal virtual view returns (bool);

  /// @dev Inheriting contract must return an interface to the underlying asset token that conforms to the ERC20 spec
  /// @return A reference to the interface of the underling asset token
  function _token() internal virtual view returns (IERC20);

  /// @dev Inheriting contract must return the balance of the underlying assets held by the Yield Service
  /// @return The underlying balance of asset tokens
  function _balance() internal virtual returns (uint256);

  /// @dev Inheriting contract must provide the ability to supply asset tokens in exchange
  /// for yield-bearing tokens to be held in escrow by the Yield Service
  /// @param mintAmount The amount of asset tokens to be supplied
  function _supply(uint256 mintAmount) internal virtual;

  /// @dev Inheriting contract must provide the ability to redeem yield-bearing tokens in exchange
  /// for the underlying asset tokens held in escrow by the Yield Service
  /// @param redeemAmount The amount of yield-bearing tokens to be redeemed
  function _redeem(uint256 redeemAmount) internal virtual;

  /// @dev Inheriting contract must provide an estimate for the amount of accrued interest that would
  /// be applied to the `principal` amount over a given number of `blocks`
  /// @param principal The amount of asset tokens to provide an estimate on
  /// @param blocks The number of blocks that the principal would accrue interest over
  /// @return The estimated interest that would accrue on the principal
  function estimateAccruedInterestOverBlocks(uint256 principal, uint256 blocks) public virtual view returns (uint256);

  /// @dev Gets the underlying asset token used by the Yield Service
  /// @return A reference to the interface of the underling asset token
  function token() external virtual view returns (IERC20) {
    return _token();
  }

  /// @dev Gets the balance of the underlying assets held by the Yield Service
  /// @return The underlying balance of asset tokens
  function balance() external virtual returns (uint256) {
    return _balance();
  }

  /// @dev Checks with the Prize Pool if a specific token type may be awarded as a prize enhancement
  /// @param _externalToken The address of the token to check
  /// @return True if the token may be awarded, false otherwise
  function canAwardExternal(address _externalToken) external virtual view returns (bool) {
    return _canAwardExternal(_externalToken);
  }

  /// @dev Inheriting contract must determine if a specific token type may be awarded as a prize enhancement
  /// @param _token The address of the token to check
  /// @return True if the token may be awarded, false otherwise
  function _canAwardExternal(address _token) internal virtual view returns (bool);

  /// @dev Inheriting contract must return an interface to the underlying asset token that conforms to the ERC20 spec
  /// @return A reference to the interface of the underling asset token
  function _token() internal virtual view returns (IERC20);

  /// @dev Inheriting contract must return the balance of the underlying assets held by the Yield Service
  /// @return The underlying balance of asset tokens
  function _balance() internal virtual returns (uint256);

  /// @dev Inheriting contract must provide the ability to supply asset tokens in exchange
  /// for yield-bearing tokens to be held in escrow by the Yield Service
  /// @param mintAmount The amount of asset tokens to be supplied
  function _supply(uint256 mintAmount) internal virtual;

  /// @dev Inheriting contract must provide the ability to redeem yield-bearing tokens in exchange
  /// for the underlying asset tokens held in escrow by the Yield Service
  /// @param redeemAmount The amount of yield-bearing tokens to be redeemed
  function _redeem(uint256 redeemAmount) internal virtual;

  /// @dev Inheriting contract must provide an estimate for the amount of accrued interest that would
  /// be applied to the `principal` amount over a given number of `blocks`
  /// @param principal The amount of asset tokens to provide an estimate on
  /// @param blocks The number of blocks that the principal would accrue interest over
  /// @return The estimated interest that would accrue on the principal
  function estimateAccruedInterestOverBlocks(uint256 principal, uint256 blocks) public virtual view returns (uint256);

  /// @dev Gets the underlying asset token used by the Yield Service
  /// @return A reference to the interface of the underling asset token
  function token() external virtual view returns (IERC20) {
    return _token();
  }

  /// @dev Gets the balance of the underlying assets held by the Yield Service
  /// @return The underlying balance of asset tokens
  function balance() external virtual returns (uint256) {
    return _balance();
  }

  /// @dev Checks with the Prize Pool if a specific token type may be awarded as a prize enhancement
  /// @param _externalToken The address of the token to check
  /// @return True if the token may be awarded, false otherwise
  function canAwardExternal(address _externalToken) external virtual view returns (bool) {
    return _canAwardExternal(_externalToken);
  }

  /// @notice Deposit assets into the Prize Pool to Purchase Tickets
  /// @param to The address receiving the Tickets
  /// @param amount The amount of assets to deposit to purchase tickets
  /// @param token The address of the Asset Token being deposited
  function depositTo(address to, uint256 amount, address token) external onlyControlledToken(token) nonReentrant {
    _updateAwardBalance();

    address operator = _msgSender();

    ControlledToken(token).controllerMint(to, amount);
    _token().transferFrom(operator, address(this), amount);
    _supply(amount);

    prizeStrategy.afterDepositTo(to, amount, token);

    emit Deposited(operator, to, token, amount);
  }

  /// @notice Withdraw assets from the Prize Pool instantly by paying a Fairness fee if exiting early
  /// @param from The address to withdraw assets from by redeeming tickets
  /// @param amount The amount of assets to redeem for tickets
  /// @param token The address of the asset token being withdrawn
  /// @param prepaidExitFee An optional amount of assets paid by the operator used to cover exit fees
  /// @return exitFee The amount of the fairness fee paid
  function withdrawInstantlyFrom(
    address from,
    uint256 amount,
    address token,
    uint256 prepaidExitFee
  )
    external
    nonReentrant
    onlyControlledToken(token)
    returns (uint256 exitFee)
  {
    _updateAwardBalance();

    address operator = _msgSender();
    exitFee = prizeStrategy.calculateInstantWithdrawalFee(from, amount, token);
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

    prizeStrategy.afterWithdrawInstantlyFrom(operator, from, amount, token, exitFee, sponsoredExitFee);

    emit InstantWithdrawal(operator, from, token, amount, exitFee, sponsoredExitFee);
  }

  /// @notice Withdraw assets from the Prize Pool with a timelock on the assets
  /// @dev The timelock is used to ensure that the tickets have contributed their equal weight
  /// in the Prize before being withdrawn, in order to prevent gaming the system
  /// @param from The address to withdraw assets from by redeeming tickets
  /// @param amount The amount of assets to redeem for tickets
  /// @param token The address of the asset token being withdrawn
  /// @return unlockTimestamp The unlock timestamp that the assets will be released upon
  function withdrawWithTimelockFrom(
    address from,
    uint256 amount,
    address token
  )
    external
    nonReentrant
    onlyControlledToken(token)
    returns (uint256 unlockTimestamp)
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

    // the block at which the funds will be available
    unlockTimestamp = prizeStrategy.calculateWithdrawalUnlockTimestamp(from, amount, token);
    unlockTimestamps[from] = unlockTimestamp;

    prizeStrategy.afterWithdrawWithTimelockFrom(from, amount, token);

    emit TimelockedWithdrawal(operator, from, token, amount, unlockTimestamp);

    // if the funds should already be unlocked
    if (unlockTimestamp <= _currentTime()) {
      sweepTimelockBalances(users);
    }
  }

  /// @notice Updates the Prize Strategy when Tickets are transferred between holders
  /// @param from The address the tickets are being transferred from
  /// @param to The address the tickets are being transferred to
  /// @param amount The amount of tickets being trasferred
  function beforeTokenTransfer(address from, address to, uint256 amount) external override {
    // minting and redeeming are handled separately
    if (from != address(0) && to != address(0)) {
      prizeStrategy.beforeTokenTransfer(from, to, amount, msg.sender);
    }
  }

  /// @notice Pokes the current award balance of the Prize Pool
  /// @dev Updates the internal rolling interest rate since the last poke
  /// @return award The total amount of assets to be awarded for the current prize
  function awardBalance() external returns (uint256 award) {
    _updateAwardBalance();
    return __awardBalance;
  }

  /// @dev Calculates the current award balance based on the collateral & rolling interest rate
  /// @dev The interest-index is the rolling or "accrued" exchange-rate on the unaccounted collateral since the last update.
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

  /// @notice Gets the rolling interest rate since the last award update
  /// @return interestRate The rolling interest rate
  function interestIndexMantissa() external returns (uint256 interestRate) {
    _updateAwardBalance();
    return uint256(interestIndex.mantissa);
  }

  /// @notice Called by the Prize-Strategy to Award a Prize to a specific account
  /// @param to The address of the winner that receives the award
  /// @param amount The amount of assets to be awarded
  /// @param token The addess of the asset token being awarded
  function award(
    address to,
    uint256 amount,
    address token
  )
    external
    onlyPrizeStrategy
    onlyControlledToken(token)
  {
    if (amount == 0) {
      return;
    }

    _updateAwardBalance();
    ControlledToken(token).controllerMint(to, amount);
    __awardBalance = __awardBalance.sub(amount);

    emit Awarded(to, token, amount);
  }

  /// @notice Called by the Prize-Strategy to Award Secondary (external) Prize amounts to a specific account
  /// @dev Used to award any arbitrary tokens held by the Prize Pool
  /// @param to The address of the winner that receives the award
  /// @param amount The amount of external assets to be awarded
  /// @param token The addess of the external asset token being awarded
  function awardExternal(address to, uint256 amount, address token) external onlyPrizeStrategy {
    require(_canAwardExternal(token), "PrizePool/invalid-external-token");

    if (amount == 0) {
      return;
    }

    IERC20(token).transfer(to, amount);

    emit AwardedExternal(to, token, amount);
  }

  /// @notice Sweep all timelocked balances and transfer unlocked assets to owner accounts
  /// @param users An array of account addresses to sweep balances for
  /// @return totalWithdrawal The total amount of assets swept from the Prize Pool
  function sweepTimelockBalances(address[] memory users) public returns (uint256 totalWithdrawal) {
    address operator = _msgSender();

    // first gather the total withdrawal and fee
    totalWithdrawal = _calculateTotalForSweep(users);
    // if there is nothing to do, just quit
    if (totalWithdrawal == 0) {
      return 0;
    }

    _redeem(totalWithdrawal);

    BalanceChange[] memory changes = new BalanceChange[](users.length);

    IERC20 token = IERC20(_token());
    uint256 i;
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
        prizeStrategy.afterSweepTimelockedWithdrawal(operator, change.user, change.balance);
      }
    }
  }

  /// @dev Calculates the total amount of unlocked assets available to be withdrawn via Sweep
  /// @param users An array of account addresses to sweep balances for
  /// @return totalWithdrawal The total amount of assets that can be swept from the Prize Pool
  function _calculateTotalForSweep(address[] memory users) internal view returns (uint256 totalWithdrawal) {
    for (uint256 i = 0; i < users.length; i++) {
      address user = users[i];
      if (unlockTimestamps[user] <= _currentTime()) {
        totalWithdrawal = totalWithdrawal.add(timelockBalances[user]);
      }
    }
  }

  /// @notice An array of the Tokens controlled by the Prize Pool (ie. Tickets, Sponsorship)
  /// @return controlledTokens An array of controlled token addresses
  function tokens() external view returns (address[] memory controlledTokens) {
    return _tokens.addressArray();
  }

  /// @dev Gets the current time as represented by the current block
  /// @return timestamp The timestamp of the current block
  function _currentTime() internal virtual view returns (uint256 timestamp) {
    return block.timestamp;
  }

  /// @notice The timestamp at which an accounts timelocked balance will be made available
  /// @param user The address of an account with timelocked assets
  /// @return unlockTimestamp The timestamp at which the locked assets will be made available
  function timelockBalanceAvailableAt(address user) external view returns (uint256 unlockTimestamp) {
    return unlockTimestamps[user];
  }

  /// @notice The balance of timelocked assets for an account
  /// @param user The address of an account with timelocked assets
  /// @return timelockBalance The amount of assets that have been timelocked
  function timelockBalanceOf(address user) external view returns (uint256 timelockBalance) {
    return timelockBalances[user];
  }

  /// @notice The currently accounted-for balance in relation to the rolling exchange-rate
  /// @return totalAccounted The currently accounted-for balance
  function accountedBalance() external view returns (uint256 totalAccounted) {
    return _tokenTotalSupply();
  }

  /// @dev The currently accounted-for balance in relation to the rolling exchange-rate
  /// @return total The currently accounted-for balance
  function _tokenTotalSupply() internal view returns (uint256 total) {
    total = timelockTotalSupply;
    address currentToken = _tokens.addressMap[MappedSinglyLinkedList.SENTINAL_TOKEN];
    while (currentToken != address(0) && currentToken != MappedSinglyLinkedList.SENTINAL_TOKEN) {
      total = total.add(IERC20(currentToken).totalSupply());
      currentToken = _tokens.addressMap[currentToken];
    }
  }

  /// @dev Checks if a specific token is controlled by the Prize Pool
  /// @param _token The address of the token to check
  /// @return True if the token is a controlled token, false otherwise
  function isControlled(address _token) internal view returns (bool) {
    return _tokens.contains(_token);
  }

  /// @dev Function modifier to ensure usage of tokens controlled by the Prize Pool
  /// @param _token The address of the token to check
  modifier onlyControlledToken(address _token) {
    require(isControlled(_token), "PrizePool/unknown-token");
    _;
  }

  /// @dev Function modifier to ensure caller is the prize-strategy
  modifier onlyPrizeStrategy() {
    require(msg.sender == address(prizeStrategy), "PrizePool/only-prizeStrategy");
    _;
  }
}
