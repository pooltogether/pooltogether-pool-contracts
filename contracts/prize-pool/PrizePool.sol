pragma solidity 0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@nomiclabs/buidler/console.sol";

import "../comptroller/ComptrollerInterface.sol";
import "../token/ControlledToken.sol";
import "../token/TokenControllerInterface.sol";
import "../utils/MappedSinglyLinkedList.sol";
import "../utils/RelayRecipient.sol";

/// @title Base Prize Pool for managing escrowed assets
/// @notice Manages depositing and withdrawing assets from the Prize Pool
/// @dev Must be inherited to provide specific yield-bearing asset control, such as Compound cTokens
abstract contract PrizePool is OwnableUpgradeSafe, RelayRecipient, ReentrancyGuardUpgradeSafe, TokenControllerInterface {
  using SafeMath for uint256;
  using SafeCast for uint256;
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;

  /// @dev Emitted when an instance is initialized
  event Initialized(
    address trustedForwarder,
    address comptroller,
    uint256 maxExitFeeMantissa,
    uint256 maxTimelockDuration
  );

  /// @dev Event emitted when controlled token is added
  event ControlledTokenAdded(
    address indexed token
  );

  /// @dev Set when the comptroller changes the type of reserve token
  event ReserveFeeControlledTokenSet(
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
    uint256 amount,
    uint256 reserveFee
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

  event CreditRateSet(
    address controlledToken,
    uint128 creditLimitMantissa,
    uint128 creditRateMantissa
  );

  event PrizeStrategySet(address indexed prizeStrategy);

  /// @dev Event emitted when the prize pool enters emergency shutdown mode
  event EmergencyShutdown();

  struct CreditRate {
    uint128 creditLimitMantissa;
    uint128 creditRateMantissa;
  }

  struct CreditBalance {
    uint192 balance;
    uint32 timestamp;
    bool initialized;
  }

  /// @dev Comptroller to which reserve fees are sent
  ComptrollerInterface public comptroller;

  /// @dev Controlled token to serve as the reserve fee
  address public reserveFeeControlledToken;

  /// @dev A linked list of all the controlled tokens
  MappedSinglyLinkedList.Mapping internal _tokens;

  /// @dev The Prize Strategy that this Prize Pool is bound to.
  PrizePoolTokenListenerInterface public prizeStrategy;

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

  // Mapping from token => TokenCredit
  mapping(address => CreditRate) internal tokenCreditRates;

  // Mapping from token address => user address => CreditBalance
  mapping(address => mapping(address => CreditBalance)) internal tokenCreditBalances;

  /// @notice Initializes the Prize Pool with required contract connections
  /// @param _trustedForwarder Address of the Forwarding Contract for GSN Meta-Txs
  /// @param _prizeStrategy Address of the component-controller that manages the prize-strategy
  /// @param _controlledTokens Array of addresses for the Ticket and Sponsorship Tokens controlled by the Prize Pool
  /// @param _maxExitFeeMantissa The maximum exit fee size, relative to the withdrawal amount
  /// @param _maxTimelockDuration The maximum length of time the withdraw timelock could be
  function initialize (
    address _trustedForwarder,
    PrizePoolTokenListenerInterface _prizeStrategy,
    ComptrollerInterface _comptroller,
    address[] memory _controlledTokens,
    uint256 _maxExitFeeMantissa,
    uint256 _maxTimelockDuration
  )
    public
    initializer
  {
    require(address(_comptroller) != address(0), "PrizePool/comptroller-not-zero");
    require(_trustedForwarder != address(0), "PrizePool/forwarder-not-zero");
    comptroller = _comptroller;
    _setPrizeStrategy(address(_prizeStrategy));
    _tokens.initialize();
    for (uint256 i = 0; i < _controlledTokens.length; i++) {
      _addControlledToken(_controlledTokens[i]);
    }
    __Ownable_init();
    __ReentrancyGuard_init();
    trustedForwarder = _trustedForwarder;
    maxExitFeeMantissa = _maxExitFeeMantissa;
    maxTimelockDuration = _maxTimelockDuration;

    emit Initialized(
      _trustedForwarder,
      address(_comptroller),
      maxExitFeeMantissa,
      maxTimelockDuration
    );
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

  /// @dev Sets which controlled token will be minted as the reserve fee.  Only callable by the owner.
  /// @param controlledToken The controlled token to mint.  This must be controlled by the PrizePool.
  function setReserveFeeControlledToken(address controlledToken) external onlyControlledToken(controlledToken) onlyOwner {
    reserveFeeControlledToken = controlledToken;

    emit ReserveFeeControlledTokenSet(controlledToken);
  }

  /// @notice Deposits timelocked tokens for a user back into the Prize Pool as another asset.
  /// @param to The address receiving the tokens
  /// @param amount The amount of timelocked assets to re-deposit
  /// @param controlledToken The type of token to be minted in exchange (i.e. tickets or sponsorship)
  function timelockDepositTo(
    address to,
    uint256 amount,
    address controlledToken
  )
    external
    onlyControlledToken(controlledToken)
    notShutdown
    nonReentrant
  {
    address operator = _msgSender();
    _mint(to, amount, controlledToken, address(0));
    _timelockBalances[operator] = _timelockBalances[operator].sub(amount);
    timelockTotalSupply = timelockTotalSupply.sub(amount);

    emit TimelockDeposited(operator, to, controlledToken, amount);
  }

  /// @notice Deposit assets into the Prize Pool in exchange for tokens
  /// @param to The address receiving the newly minted tokens
  /// @param amount The amount of assets to deposit
  /// @param controlledToken The address of the type of token the user is minting
  /// @param referrer The referrer of the deposit
  function depositTo(
    address to,
    uint256 amount,
    address controlledToken,
    address referrer
  )
    external
    onlyControlledToken(controlledToken)
    notShutdown
    nonReentrant
  {
    address operator = _msgSender();

    _mint(to, amount, controlledToken, referrer);

    require(_token().transferFrom(operator, address(this), amount), "PrizePool/deposit-transfer-failed");
    _supply(amount);

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
    uint256 maximumExitFee
  )
    external
    nonReentrant
    onlyControlledToken(controlledToken)
    returns (uint256)
  {
    uint256 exitFee = _calculateEarlyExitFeeLessBurnedCredit(from, controlledToken, amount);
    require(exitFee <= maximumExitFee, "PrizePool/exit-fee-exceeds-user-maximum");

    // burn the tickets
    ControlledToken(controlledToken).controllerBurnFrom(_msgSender(), from, amount);
    // redeem the tickets less the fee
    uint256 amountLessFee = amount.sub(exitFee);
    _redeem(amountLessFee);
    require(_token().transfer(from, amountLessFee), "PrizePool/instant-transfer-failed");

    emit InstantWithdrawal(_msgSender(), from, controlledToken, amount, exitFee);

    return exitFee;
  }

  /// @notice Limits the exit fee to the maximum as hard-coded into the contract
  /// @param withdrawalAmount The amount that is attempting to be withdrawn
  /// @param exitFee An exit fee to check
  /// @return The passed exit fee if it is less than the maximum, otherwise the maximum fee is returned.
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
    address controlledToken
  )
    external
    nonReentrant
    onlyControlledToken(controlledToken)
    returns (uint256)
  {
    uint256 blockTime = _currentTime();
    uint256 lockDuration = _calculateTimelockDuration(from, controlledToken, amount);
    uint256 unlockTimestamp = blockTime.add(lockDuration);

    ControlledToken(controlledToken).controllerBurnFrom(_msgSender(), from, amount);
    _mintTimelock(from, amount, unlockTimestamp);

    emit TimelockedWithdrawal(_msgSender(), from, controlledToken, amount, unlockTimestamp);

    // return the block at which the funds will be available
    return unlockTimestamp;
  }

  /// @notice Adds to a user's timelock balance.  It will attempt to sweep before updating the balance.  Note that this will overwrite the previous unlock timestamp.
  /// @param user The user whose timelock balance should increase
  /// @param amount The amount to increase by
  /// @param timestamp The new unlock timestamp
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
    if (from != address(0)) {
      _accrueCredit(from, msg.sender, IERC20(msg.sender).balanceOf(from), 0);
    }
    if (to != address(0)) {
      _accrueCredit(to, msg.sender, IERC20(msg.sender).balanceOf(to), 0);
    }
    // if we aren't minting
    if (from != address(0)) {
      prizeStrategy.beforeTokenTransfer(from, to, amount, msg.sender);
      if (address(comptroller) != address(0)) {
        comptroller.beforeTokenTransfer(
          from,
          to,
          amount,
          msg.sender
        );
      }
    }
  }

  /// @notice Updates and returns the current prize.
  /// @dev Updates the internal rolling interest rate since the last poke
  /// @return The total amount of assets to be awarded for the current prize
  function awardBalance() public returns (uint256) {
    uint256 tokenTotalSupply = _tokenTotalSupply();
    uint256 bal = _balance();
    if (bal > tokenTotalSupply) {
      uint256 interest = bal.sub(tokenTotalSupply);
      uint256 reserveFee = calculateReserveFee(interest);
      return interest.sub(reserveFee);
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

    _mint(to, amount, controlledToken, address(0));

    uint256 reserveFee = calculateReserveFee(amount);
    if (reserveFee > 0) {
      _mint(address(comptroller), reserveFee, reserveFeeControlledToken, address(0));
    }

    uint256 extraCredit = _calculateEarlyExitFee(controlledToken, amount);
    _accrueCredit(to, controlledToken, IERC20(controlledToken).balanceOf(to), extraCredit);

    emit Awarded(to, controlledToken, amount, reserveFee);
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

  /// @notice Called to mint controlled tokens.  Ensures that token listener callbacks are fired.
  /// @param to The user who is receiving the tokens
  /// @param amount The amount of tokens they are receiving
  /// @param controlledToken The token that is going to be minted
  /// @param referrer The user who referred the minting
  function _mint(address to, uint256 amount, address controlledToken, address referrer) internal {
    prizeStrategy.beforeTokenMint(to, amount, controlledToken, referrer);
    if (address(comptroller) != address(0)) {
      comptroller.beforeTokenMint(
        to,
        amount,
        controlledToken,
        referrer
      );
    }
    ControlledToken(controlledToken).controllerMint(to, amount);
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

  /// @notice Calculates the reserve portion of the given amount of funds.  If there is no reserve address, the portion will be zero.
  /// @param amount The prize amount
  /// @return The size of the reserve portion of the prize
  function calculateReserveFee(uint256 amount) public view returns (uint256) {
    if (address(comptroller) == address(0)) {
      return 0;
    }
    uint256 reserveRateMantissa = comptroller.reserveRateMantissa();
    if (reserveRateMantissa == 0 || reserveFeeControlledToken == address(0)) {
      return 0;
    }
    return FixedPoint.multiplyUintByMantissa(amount, reserveRateMantissa);
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

    return totalWithdrawal;
  }

  /// @notice Calculates a timelocked withdrawal duration and credit consumption.
  /// @param from The user who is withdrawing
  /// @param amount The amount the user is withdrawing
  /// @param controlledToken The type of collateral the user is withdrawing (i.e. ticket or sponsorship)
  /// @return durationSeconds The duration of the timelock in seconds
  function _calculateTimelockDuration(
    address from,
    address controlledToken,
    uint256 amount
  )
    internal
    returns (uint256)
  {
    uint256 exitFee = _calculateEarlyExitFeeLessBurnedCredit(from, controlledToken, amount);
    uint256 duration = _estimateCreditAccrualTime(controlledToken, amount, exitFee);
    if (duration > maxTimelockDuration) {
      duration = maxTimelockDuration;
    }
    return duration;
  }

  /// @notice Calculates the early exit fee for the given amount
  /// @param amount The amount of collateral to be withdrawn
  /// @return Exit fee
  function _calculateEarlyExitFee(address controlledToken, uint256 amount) internal view returns (uint256) {
    uint256 exitFee = FixedPoint.multiplyUintByMantissa(amount, tokenCreditRates[controlledToken].creditLimitMantissa);
    uint256 maxFee = FixedPoint.multiplyUintByMantissa(amount, maxExitFeeMantissa);
    if (exitFee > maxFee) {
      exitFee = maxFee;
    }
    return exitFee;
  }

  /// @notice Estimates the amount of time it will take for a given amount of funds to accrue the given amount of credit.
  /// @param _principal The principal amount on which interest is accruing
  /// @param _interest The amount of interest that must accrue
  /// @return durationSeconds The duration of time it will take to accrue the given amount of interest, in seconds.
  function estimateCreditAccrualTime(
    address _controlledToken,
    uint256 _principal,
    uint256 _interest
  )
    external
    view
    returns (uint256 durationSeconds)
  {
    return _estimateCreditAccrualTime(
      _controlledToken,
      _principal,
      _interest
    );
  }

  /// @notice Estimates the amount of time it will take for a given amount of funds to accrue the given amount of credit
  /// @param _principal The principal amount on which interest is accruing
  /// @param _interest The amount of interest that must accrue
  /// @return durationSeconds The duration of time it will take to accrue the given amount of interest, in seconds.
  function _estimateCreditAccrualTime(
    address _controlledToken,
    uint256 _principal,
    uint256 _interest
  )
    internal
    view
    returns (uint256 durationSeconds)
  {
    // interest = credit rate * principal * time
    // => time = interest / (credit rate * principal)
    uint256 accruedPerSecond = FixedPoint.multiplyUintByMantissa(_principal, tokenCreditRates[_controlledToken].creditRateMantissa);
    if (accruedPerSecond == 0) {
      return 0;
    }
    return _interest.div(accruedPerSecond);
  }

  /// @notice Burns a users credit
  /// @param user The user whose credit should be burned
  /// @param credit The amount of credit to burn
  function _burnCredit(address user, address controlledToken, uint256 credit) internal {
    tokenCreditBalances[controlledToken][user].balance = uint256(tokenCreditBalances[controlledToken][user].balance).sub(credit).toUint128();
  }

  /// @notice Accrues ticket credit for a user assuming their current balance is the passed balance.
  /// @param user The user for whom to accrue credit
  /// @param controlledToken The controlled token whose balance we are checking
  /// @param controlledTokenBalance The balance to use for the user
  /// @param extra Additional credit to be added
  function _accrueCredit(address user, address controlledToken, uint256 controlledTokenBalance, uint256 extra) internal {
    uint256 credit = calculateAccruedCredit(user, controlledToken, controlledTokenBalance);
    CreditBalance storage creditBalance = tokenCreditBalances[controlledToken][user];
    uint128 newBalance = _applyCreditLimit(controlledToken, controlledTokenBalance, uint256(creditBalance.balance).add(credit).add(extra)).toUint128();
    if (creditBalance.balance != newBalance || creditBalance.timestamp == 0) {
      tokenCreditBalances[controlledToken][user] = CreditBalance({
        balance: newBalance,
        timestamp: _currentTime().toUint32(),
        initialized: true
      });
    }
  }

  /// @notice Applies the credit limit to a credit balance.  The balance cannot exceed the credit limit.
  /// @param controlledToken The controlled token that the user holds
  /// @param controlledTokenBalance The users ticket balance (used to calculate credit limit)
  /// @param creditBalance The new credit balance to be checked
  /// @return The users new credit balance.  Will not exceed the credit limit.
  function _applyCreditLimit(address controlledToken, uint256 controlledTokenBalance, uint256 creditBalance) internal view returns (uint256) {
    uint256 creditLimit = FixedPoint.multiplyUintByMantissa(
      controlledTokenBalance,
      tokenCreditRates[controlledToken].creditLimitMantissa
    );
    if (creditBalance > creditLimit) {
      creditBalance = creditLimit;
    }

    return creditBalance;
  }

  /// @notice Calculates the accrued interest for a user
  /// @param user The user whose credit should be calculated.
  /// @param controlledToken The controlled token that the user holds
  /// @param controlledTokenBalance The user's current balance of the controlled tokens.
  /// @return The credit that has accrued since the last credit update.
  function calculateAccruedCredit(address user, address controlledToken, uint256 controlledTokenBalance) internal view returns (uint256) {
    uint256 userTimestamp = tokenCreditBalances[controlledToken][user].timestamp;

    if (!tokenCreditBalances[controlledToken][user].initialized) {
      return 0;
    }

    uint256 deltaTime = _currentTime().sub(userTimestamp);
    uint256 creditPerSecond = FixedPoint.multiplyUintByMantissa(controlledTokenBalance, tokenCreditRates[controlledToken].creditRateMantissa);
    return deltaTime.mul(creditPerSecond);
  }

  /// @notice Returns the credit balance for a given user.  Not that this includes both minted credit and pending credit.
  /// @param user The user whose credit balance should be returned
  /// @return The balance of the users credit
  function balanceOfCredit(address user, address controlledToken) external onlyControlledToken(controlledToken) returns (uint256) {
    _accrueCredit(user, controlledToken, IERC20(controlledToken).balanceOf(user), 0);
    return tokenCreditBalances[controlledToken][user].balance;
  }

  /// @notice Sets the rate at which credit accrues per second.  The credit rate is a fixed point 18 number (like Ether).
  /// @param _creditRateMantissa The credit rate to set
  function setCreditRateOf(address controlledToken, uint128 _creditRateMantissa, uint128 _creditLimitMantissa) external onlyControlledToken(controlledToken) onlyOwner {
    tokenCreditRates[controlledToken] = CreditRate({
      creditLimitMantissa: _creditLimitMantissa,
      creditRateMantissa: _creditRateMantissa
    });

    emit CreditRateSet(controlledToken, _creditLimitMantissa, _creditRateMantissa);
  }

  /// @notice Returns the credit rate of a controlled token
  /// @param controlledToken The controlled token to retrieve the credit rates for
  /// @return creditLimitMantissa The credit limit fraction.  This number is used to calculate both the credit limit and early exit fee.
  /// @return creditRateMantissa The credit rate. This is the amount of tokens that accrue per second.
  function creditRateOf(address controlledToken) external view returns (uint128 creditLimitMantissa, uint128 creditRateMantissa) {
    creditLimitMantissa = tokenCreditRates[controlledToken].creditLimitMantissa;
    creditRateMantissa = tokenCreditRates[controlledToken].creditRateMantissa;
  }

  /// @notice Calculate the early exit for a user given a withdrawal amount.  The user's credit is taken into account.
  /// @param from The user who is withdrawing
  /// @param controlledToken The token they are withdrawing
  /// @param amount The amount of funds they are withdrawing
  /// @return earlyExitFee The additional exit fee that should be charged.
  function _calculateEarlyExitFeeLessBurnedCredit(
    address from,
    address controlledToken,
    uint256 amount
  )
    internal
    returns (uint256)
  {
    uint256 controlledTokenBalance = IERC20(controlledToken).balanceOf(from);
    _accrueCredit(from, controlledToken, controlledTokenBalance, 0);

    /*
    The credit is used *last*.  Always charge the fees up-front.

    How to calculate:

    Calculate their remaining exit fee.  I.e. full exit fee of their balance less their credit.

    If the exit fee on their withdrawal is greater than the remaining exit fee, then they'll have to pay the difference.
    */

    // Determine available usable credit based on withdraw amount
    uint256 availableCredit;
    uint256 remainingExitFee = _calculateEarlyExitFee(controlledToken, controlledTokenBalance.sub(amount));
    if (tokenCreditBalances[controlledToken][from].balance >= remainingExitFee) {
      availableCredit = uint256(tokenCreditBalances[controlledToken][from].balance).sub(remainingExitFee);
    }

    // Determine amount of credit to burn and amount of fees required
    uint256 totalExitFee = _calculateEarlyExitFee(controlledToken, amount);
    uint256 creditBurned = (availableCredit > totalExitFee) ? totalExitFee : availableCredit;
    uint256 earlyExitFee = totalExitFee.sub(creditBurned);

    if (creditBurned > 0) {
      _burnCredit(from, controlledToken, creditBurned);
    }

    return earlyExitFee;
  }

  /// @notice Allows the Governor to add Controlled Tokens to the Prize Pool
  /// @param _controlledToken The address of the Controlled Token to add
  function addControlledToken(address _controlledToken) external onlyOwner {
    _addControlledToken(_controlledToken);
  }

  /// @notice Adds a new controlled token
  /// @param _controlledToken The controlled token to add.  Cannot be a duplicate.
  function _addControlledToken(address _controlledToken) internal {
    require(ControlledToken(_controlledToken).controller() == this, "PrizePool/token-ctrlr-mismatch");
    _tokens.addAddress(_controlledToken);

    emit ControlledTokenAdded(_controlledToken);
  }

  /// @notice Sets the prize strategy of the prize pool.  Only callable by the owner.
  /// @param _prizeStrategy The new prize strategy
  function setPrizeStrategy(address _prizeStrategy) external onlyOwner {
    _setPrizeStrategy(_prizeStrategy);
  }

  /// @notice Sets the prize strategy of the prize pool.  Only callable by the owner.
  /// @param _prizeStrategy The new prize strategy
  function _setPrizeStrategy(address _prizeStrategy) internal {
    require(address(_prizeStrategy) != address(0), "PrizePool/prizeStrategy-not-zero");
    prizeStrategy = PrizePoolTokenListenerInterface(_prizeStrategy);

    emit PrizeStrategySet(_prizeStrategy);
  }

  /// @notice Emergency shutdown of the Prize Pool by detaching the Prize Strategy
  /// @dev Called by the PrizeStrategy contract to issue an Emergency Shutdown of a corrupted Prize Strategy
  function emergencyShutdown() external onlyOwner {
    delete comptroller;

    emit EmergencyShutdown();
  }

  /// @notice Check if the Prize Pool has an active Prize Strategy
  /// @dev When the prize strategy is detached deposits are disabled, and only withdrawals are permitted
  function isShutdown() public view returns (bool) {
    return address(comptroller) != address(0);
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

  modifier notShutdown() {
    require(address(comptroller) != address(0), "PrizePool/shutdown");
    _;
  }
}
