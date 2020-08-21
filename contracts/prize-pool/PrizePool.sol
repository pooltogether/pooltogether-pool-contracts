pragma solidity 0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "../prize-strategy/PrizeStrategyInterface.sol";
import "../token/ControlledToken.sol";
import "../token/TokenControllerInterface.sol";
import "../utils/MappedSinglyLinkedList.sol";
import "../utils/RelayRecipient.sol";

/// @title Base Prize Pool for managing escrowed assets
/// @notice Manages depositing and withdrawing assets from the Prize Pool
/// @dev Must be inherited to provide specific yield-bearing asset control, such as Compound cTokens
abstract contract PrizePool is OwnableUpgradeSafe, RelayRecipient, ReentrancyGuardUpgradeSafe, TokenControllerInterface {
  using SafeMath for uint256;
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;

  /// @dev Event emitted when controlled token is added
  event ControlledTokenAdded(
    address indexed token
  );

  /// @dev Event emitted when assets are deposited
  event Deposited(
    address indexed operator,
    address indexed to,
    address indexed token,
    uint256 amount
  );

  /// @dev Event emitted when timelocked funds are re-deposited
  event TimelockDeposited(
    address indexed operator,
    address indexed to,
    address indexed token,
    uint256 amount
  );

  /// @dev Event emitted when interest is awarded to a winner
  event Awarded(
    address indexed winner,
    address indexed token,
    uint256 amount
  );
  
  /// @dev Event emitted when external ERC20s are awarded to a winner
  event AwardedExternalERC20(
    address indexed winner,
    address indexed token,
    uint256 amount
  );

  /// @dev Event emitted when external ERC721s are awarded to a winner
  event AwardedExternalERC721(
    address indexed winner,
    address indexed token,
    uint256[] tokenIds
  );
  
  /// @dev Event emitted when assets are withdrawn instantly
  event InstantWithdrawal(
    address indexed operator,
    address indexed from,
    address indexed token,
    uint256 amount,
    uint256 exitFee
  );
  
  /// @dev Event emitted when assets are withdrawn into a timelock
  event TimelockedWithdrawal(
    address indexed operator,
    address indexed from,
    address indexed token,
    uint256 amount,
    uint256 unlockTimestamp
  );
  
  /// @dev Event emitted when timelocked funds are swept back to a user
  event TimelockedWithdrawalSwept(
    address indexed operator,
    address indexed from,
    uint256 amount
  );

  /// @dev Event emitted when the prize strategy is detached from the Prize Pool.
  event PrizeStrategyDetached();

  /// @dev A linked list of all the controlled tokens
  MappedSinglyLinkedList.Mapping internal _tokens;

  /// @dev The Prize Strategy that this Prize Pool is bound to.
  PrizeStrategyInterface public prizeStrategy;

  /// @dev The maximum possible exit fee fraction as a fixed point 18 number.
  /// For example, if the maxExitFeeMantissa is "0.1 ether", then the maximum exit fee for a withdrawal of 100 will be 10.
  uint256 public maxExitFeeMantissa;

  /// @dev The maximum possible timelock duration for a timelocked withdrawal.
  uint256 public maxTimelockDuration;

  /// @dev The total funds that are timelocked.
  uint256 public timelockTotalSupply;

  /// @dev The timelocked balances for each user
  mapping(address => uint256) internal _timelockBalances;

  /// @dev The unlock timestamps for each user
  mapping(address => uint256) internal _unlockTimestamps;

  /// @notice Initializes the Prize Pool with required contract connections
  /// @param _trustedForwarder Address of the Forwarding Contract for GSN Meta-Txs
  /// @param _prizeStrategy Address of the component-controller that manages the prize-strategy
  /// @param _controlledTokens Array of addresses for the Ticket and Sponsorship Tokens controlled by the Prize Pool
  /// @param _maxExitFeeMantissa The maximum exit fee size, relative to the withdrawal amount
  /// @param _maxTimelockDuration The maximum length of time the withdraw timelock could be
  function initialize (
    address _trustedForwarder,
    PrizeStrategyInterface _prizeStrategy,
    address[] memory _controlledTokens,
    uint256 _maxExitFeeMantissa,
    uint256 _maxTimelockDuration
  )
    public
    initializer
  {
    require(address(_prizeStrategy) != address(0), "PrizePool/prizeStrategy-zero");
    require(_trustedForwarder != address(0), "PrizePool/forwarder-zero");
    _tokens.initialize();
    _tokens.addAddresses(_controlledTokens);
    for (uint256 i = 0; i < _controlledTokens.length; i++) {
      require(ControlledToken(_controlledTokens[i]).controller() == this, "PrizePool/token-ctrlr-mismatch");
    }
    __Ownable_init();
    __ReentrancyGuard_init();
    trustedForwarder = _trustedForwarder;
    prizeStrategy = _prizeStrategy;
    maxExitFeeMantissa = _maxExitFeeMantissa;
    maxTimelockDuration = _maxTimelockDuration;
  }

  /// @dev Inheriting contract must determine if a specific token type may be awarded as a prize enhancement
  /// @param _externalToken The address of the token to check
  /// @return True if the token may be awarded, false otherwise
  function _canAwardExternal(address _externalToken) internal virtual view returns (bool);

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

  /// @notice Deposits timelocked tokens for a user back into the Prize Pool as another asset.
  /// @param to The address receiving the tokens
  /// @param amount The amount of timelocked assets to re-deposit
  /// @param controlledToken The type of token to be minted in exchange (i.e. tickets or sponsorship)
  function timelockDepositTo(
    address to,
    uint256 amount,
    address controlledToken,
    bytes calldata data
  )
    external
    onlyControlledToken(controlledToken)
    nonReentrant
  {
    require(_hasPrizeStrategy(), "PrizePool/prize-strategy-detached");

    address operator = _msgSender();

    ControlledToken(controlledToken).controllerMint(to, amount);
    _timelockBalances[operator] = _timelockBalances[operator].sub(amount);
    timelockTotalSupply = timelockTotalSupply.sub(amount);

    prizeStrategy.afterTimelockDepositTo(operator, to, amount, controlledToken, data);

    emit TimelockDeposited(operator, to, controlledToken, amount);
  }

  /// @notice Deposit assets into the Prize Pool in exchange for tokens
  /// @param to The address receiving the newly minted tokens
  /// @param amount The amount of assets to deposit
  /// @param controlledToken The address of the type of token the user is minting
  /// @param data Call data to be passed to the Prize Strategy
  function depositTo(
    address to,
    uint256 amount,
    address controlledToken,
    bytes calldata data
  )
    external
    onlyControlledToken(controlledToken)
    nonReentrant
  {
    require(_hasPrizeStrategy(), "PrizePool/prize-strategy-detached");

    address operator = _msgSender();

    ControlledToken(controlledToken).controllerMint(to, amount);
    require(_token().transferFrom(operator, address(this), amount), "PrizePool/deposit-transfer-failed");
    _supply(amount);

    prizeStrategy.afterDepositTo(to, amount, controlledToken, data);

    emit Deposited(operator, to, controlledToken, amount);
  }

  /// @notice Withdraw assets from the Prize Pool instantly.  A fairness fee may be charged for an early exit.
  /// @param from The address to redeem tokens from.
  /// @param amount The amount of tokens to redeem for assets.
  /// @param controlledToken The address of the token to redeem (i.e. ticket or sponsorship)
  /// @param maximumExitFee The maximum exit fee the caller is willing to pay.  This can be pre-calculated.
  /// @return The amount of the fairness fee paid
  function withdrawInstantlyFrom(
    address from,
    uint256 amount,
    address controlledToken,
    uint256 maximumExitFee,
    bytes calldata data
  )
    external
    nonReentrant
    onlyControlledToken(controlledToken)
    returns (uint256)
  {

    uint256 exitFee;
    if (_hasPrizeStrategy()) {
      exitFee = _limitExitFee(amount, prizeStrategy.beforeWithdrawInstantlyFrom(from, amount, controlledToken, data));
    }

    require(exitFee <= maximumExitFee, "PrizePool/exit-fee-exceeds-user-maximum");

    // burn the tickets
    ControlledToken(controlledToken).controllerBurnFrom(_msgSender(), from, amount);

    // redeem the tickets less the fee
    uint256 amountLessFee = amount.sub(exitFee);
    _redeem(amountLessFee);

    require(_token().transfer(from, amountLessFee), "PrizePool/instant-transfer-failed");

    if (_hasPrizeStrategy()) {
      prizeStrategy.afterWithdrawInstantlyFrom(_msgSender(), from, amount, controlledToken, exitFee, data);
    }

    emit InstantWithdrawal(_msgSender(), from, controlledToken, amount, exitFee);

    return exitFee;
  }

  function _limitExitFee(uint256 withdrawalAmount, uint256 exitFee) internal view returns (uint256) {
    uint256 maxFee = FixedPoint.multiplyUintByMantissa(withdrawalAmount, maxExitFeeMantissa);
    if (exitFee > maxFee) {
      exitFee = maxFee;
    }
    return exitFee;
  }

  /// @notice Withdraw assets from the Prize Pool by placing them into the timelock. The timelock is used to ensure that the tickets have contributed their fair share of the prize.
  /// @dev Note that if the user has previously timelocked funds then this contract will try to sweep them.  If the existing timelocked funds are still locked, then the incoming
  /// balance is added to their existing balance and the new timelock unlock timestamp will overwrite the old one.
  /// @param from The address to withdraw from
  /// @param amount The amount to withdraw
  /// @param controlledToken The type of token being withdrawn
  /// @return The timestamp from which the funds can be swept
  function withdrawWithTimelockFrom(
    address from,
    uint256 amount,
    address controlledToken,
    bytes calldata data
  )
    external
    nonReentrant
    onlyControlledToken(controlledToken)
    returns (uint256)
  {
    uint256 blockTime = _currentTime();

    uint256 unlockTimestamp;

    if (_hasPrizeStrategy()) {
      unlockTimestamp = prizeStrategy.beforeWithdrawWithTimelockFrom(from, amount, controlledToken, data);
    }

    uint256 lockDuration = unlockTimestamp > blockTime ? unlockTimestamp.sub(blockTime) : 0;
    if (lockDuration > maxTimelockDuration) {
      unlockTimestamp = blockTime.add(maxTimelockDuration);
    }

    ControlledToken(controlledToken).controllerBurnFrom(_msgSender(), from, amount);
    _mintTimelock(from, amount, unlockTimestamp);

    if (_hasPrizeStrategy()) {
      prizeStrategy.afterWithdrawWithTimelockFrom(from, amount, controlledToken, data);
    }

    emit TimelockedWithdrawal(_msgSender(), from, controlledToken, amount, unlockTimestamp);

    // return the block at which the funds will be available
    return unlockTimestamp;
  }

  function _mintTimelock(address user, uint256 amount, uint256 timestamp) internal {
    // Sweep the old balance, if any
    address[] memory users = new address[](1);
    users[0] = user;
    _sweepTimelockBalances(users);

    timelockTotalSupply = timelockTotalSupply.add(amount);
    _timelockBalances[user] = _timelockBalances[user].add(amount);
    _unlockTimestamps[user] = timestamp;

    // if the funds should already be unlocked
    if (timestamp <= _currentTime()) {
      _sweepTimelockBalances(users);
    }
  }

  /// @notice Updates the Prize Strategy when tokens are transferred between holders.  Only transfers, not minting or burning.
  /// @param from The address the tokens are being transferred from
  /// @param to The address the tokens are being transferred to
  /// @param amount The amount of tokens being trasferred
  function beforeTokenTransfer(address from, address to, uint256 amount) external override onlyControlledToken(msg.sender) {
    // minting and redeeming are handled separately
    if (from != address(0) && to != address(0) && _hasPrizeStrategy()) {
      prizeStrategy.beforeTokenTransfer(from, to, amount, msg.sender);
    }
  }

  /// @notice Updates and returns the current prize.
  /// @dev Updates the internal rolling interest rate since the last poke
  /// @return The total amount of assets to be awarded for the current prize
  function awardBalance() public returns (uint256) {
    uint256 tokenTotalSupply = _tokenTotalSupply();
    uint256 bal = _balance();

    if (bal > tokenTotalSupply) {
      return bal.sub(tokenTotalSupply);
    } else {
      return 0;
    }
  }

  /// @notice Called by the Prize-Strategy to Award a Prize to a specific account
  /// @param to The address of the winner that receives the award
  /// @param amount The amount of assets to be awarded
  /// @param controlledToken The address of the asset token being awarded
  function award(
    address to,
    uint256 amount,
    address controlledToken
  )
    external
    onlyPrizeStrategy
    onlyControlledToken(controlledToken)
  {
    if (amount == 0) {
      return;
    }

    require(amount <= awardBalance(), "PrizePool/award-exceeds-avail");
    ControlledToken(controlledToken).controllerMint(to, amount);

    emit Awarded(to, controlledToken, amount);
  }

  /// @notice Called by the Prize-Strategy to Award Secondary (external) Prize amounts to a specific account
  /// @dev Used to award any arbitrary tokens held by the Prize Pool
  /// @param to The address of the winner that receives the award
  /// @param amount The amount of external assets to be awarded
  /// @param externalToken The address of the external asset token being awarded
  function awardExternalERC20(
    address to,
    address externalToken,
    uint256 amount
  )
    external
    onlyPrizeStrategy
  {
    require(_canAwardExternal(externalToken), "PrizePool/invalid-external-token");

    if (amount == 0) {
      return;
    }

    require(IERC20(externalToken).transfer(to, amount), "PrizePool/award-ex-erc20-failed");

    emit AwardedExternalERC20(to, externalToken, amount);
  }

  /// @notice Called by the Prize-Strategy to Award Secondary (external) Prize NFTs to a specific account
  /// @dev Used to award any arbitrary NFTs held by the Prize Pool
  /// @param to The address of the winner that receives the award
  /// @param externalToken The address of the external NFT token being awarded
  /// @param tokenIds An array of NFT Token IDs to be transferred
  function awardExternalERC721(
    address to,
    address externalToken,
    uint256[] calldata tokenIds
  )
    external
    onlyPrizeStrategy
  {
    require(_canAwardExternal(externalToken), "PrizePool/invalid-external-token");

    if (tokenIds.length == 0) {
      return;
    }

    for (uint256 i = 0; i < tokenIds.length; i++) {
      IERC721(externalToken).transferFrom(address(this), to, tokenIds[i]);
    }

    emit AwardedExternalERC721(to, externalToken, tokenIds);
  }

  /// @notice Sweep all timelocked balances and transfer unlocked assets to owner accounts
  /// @param users An array of account addresses to sweep balances for
  /// @return The total amount of assets swept from the Prize Pool
  function sweepTimelockBalances(
    address[] calldata users
  )
    external
    nonReentrant
    returns (uint256)
  {
    return _sweepTimelockBalances(users);
  }

  /// @notice Sweep all timelocked balances and transfer unlocked assets to owner accounts
  /// @param users An array of account addresses to sweep balances for
  /// @return The total amount of assets swept from the Prize Pool
  function _sweepTimelockBalances(
    address[] memory users
  )
    internal
    returns (uint256)
  {
    address operator = _msgSender();

    uint256[] memory balances = new uint256[](users.length);

    uint256 totalWithdrawal;

    uint256 i;
    for (i = 0; i < users.length; i++) {
      address user = users[i];
      if (_unlockTimestamps[user] <= _currentTime()) {
        totalWithdrawal = totalWithdrawal.add(_timelockBalances[user]);
        balances[i] = _timelockBalances[user];
        delete _timelockBalances[user];
      }
    }

    // if there is nothing to do, just quit
    if (totalWithdrawal == 0) {
      return 0;
    }

    timelockTotalSupply = timelockTotalSupply.sub(totalWithdrawal);

    _redeem(totalWithdrawal);

    IERC20 underlyingToken = IERC20(_token());

    for (i = 0; i < users.length; i++) {
      if (balances[i] > 0) {
        delete _unlockTimestamps[users[i]];
        require(underlyingToken.transfer(users[i], balances[i]), "PrizePool/sweep-transfer-failed");
        emit TimelockedWithdrawalSwept(operator, users[i], balances[i]);
      }
    }

    if (_hasPrizeStrategy()) {
      for (i = 0; i < users.length; i++) {
        if (balances[i] > 0) {
          prizeStrategy.afterSweepTimelockedWithdrawal(operator, users[i], balances[i]);
        }
      }
    }

    return totalWithdrawal;
  }

  /// @notice Allows the Governor to add Controlled Tokens to the Prize Pool
  /// @param _controlledToken The address of the Controlled Token to add
  function addControlledToken(address _controlledToken) external onlyOwner {
    require(ControlledToken(_controlledToken).controller() == this, "PrizePool/token-ctrlr-mismatch");
    _tokens.addAddress(_controlledToken);

    emit ControlledTokenAdded(_controlledToken);
  }

  /// @notice Emergency shutdown of the Prize Pool by detaching the Prize Strategy
  /// @dev Called by the PrizeStrategy contract to issue an Emergency Shutdown of a corrupted Prize Strategy
  function detachPrizeStrategy() external onlyOwner {
    delete prizeStrategy;
    emit PrizeStrategyDetached();
  }

  /// @notice Check if the Prize Pool has an active Prize Strategy
  /// @dev When the prize strategy is detached deposits are disabled, and only withdrawals are permitted
  function _hasPrizeStrategy() internal view returns (bool) {
    return (address(prizeStrategy) != address(0x0));
  }

  /// @notice An array of the Tokens controlled by the Prize Pool (ie. Tickets, Sponsorship)
  /// @return An array of controlled token addresses
  function tokens() external view returns (address[] memory) {
    return _tokens.addressArray();
  }

  /// @dev Gets the current time as represented by the current block
  /// @return The timestamp of the current block
  function _currentTime() internal virtual view returns (uint256) {
    return block.timestamp;
  }

  /// @notice The timestamp at which an account's timelocked balance will be made available
  /// @param user The address of an account with timelocked assets
  /// @return The timestamp at which the locked assets will be made available
  function timelockBalanceAvailableAt(address user) external view returns (uint256) {
    return _unlockTimestamps[user];
  }

  /// @notice The balance of timelocked assets for an account
  /// @param user The address of an account with timelocked assets
  /// @return The amount of assets that have been timelocked
  function timelockBalanceOf(address user) external view returns (uint256) {
    return _timelockBalances[user];
  }

  /// @notice The currently accounted-for balance in relation to the rolling exchange-rate
  /// @return The currently accounted-for balance
  function accountedBalance() external view returns (uint256) {
    return _tokenTotalSupply();
  }

  /// @dev The currently accounted-for balance in relation to the rolling exchange-rate
  /// @return The currently accounted-for balance
  function _tokenTotalSupply() internal view returns (uint256) {
    uint256 total = timelockTotalSupply;
    address currentToken = _tokens.start();
    while (currentToken != address(0) && currentToken != _tokens.end()) {
      total = total.add(IERC20(currentToken).totalSupply());
      currentToken = _tokens.next(currentToken);
    }
    return total;
  }

  /// @dev Checks if a specific token is controlled by the Prize Pool
  /// @param controlledToken The address of the token to check
  /// @return True if the token is a controlled token, false otherwise
  function _isControlled(address controlledToken) internal view returns (bool) {
    return _tokens.contains(controlledToken);
  }

  function _msgSender() internal override(BaseRelayRecipient, ContextUpgradeSafe) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }

  /// @dev Function modifier to ensure usage of tokens controlled by the Prize Pool
  /// @param controlledToken The address of the token to check
  modifier onlyControlledToken(address controlledToken) {
    require(_isControlled(controlledToken), "PrizePool/unknown-token");
    _;
  }

  /// @dev Function modifier to ensure caller is the prize-strategy
  modifier onlyPrizeStrategy() {
    require(msg.sender == address(prizeStrategy), "PrizePool/only-prizeStrategy");
    _;
  }
}
