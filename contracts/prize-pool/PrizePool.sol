pragma solidity 0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "../prize-strategy/PrizeStrategyInterface.sol";
import "../token/ControlledToken.sol";
import "../token/TokenControllerInterface.sol";
import "../utils/MappedSinglyLinkedList.sol";

/// @title Base Prize Pool for managing escrowed assets
/// @notice Manages depositing and withdrawing assets from the Prize Pool
/// @dev Must be inherited to provide specific yield-bearing asset control, such as Compound cTokens
abstract contract PrizePool is OwnableUpgradeSafe, BaseRelayRecipient, ReentrancyGuardUpgradeSafe, TokenControllerInterface {
  using SafeMath for uint256;
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;

  struct BalanceChange {
    address user;
    uint256 balance;
  }

  event CapturedAward(uint256 amount);

  event Deposited(
    address indexed operator,
    address indexed to,
    address indexed token,
    uint256 amount
  );

  event TimelockDeposited(
    address indexed operator,
    address indexed to,
    address indexed token,
    uint256 amount
  );

  event Awarded(
    address indexed winner,
    address indexed token,
    uint256 amount
  );
  
  event AwardedExternalERC20(
    address indexed winner,
    address indexed token,
    uint256 amount
  );

  event AwardedExternalERC721(
    address indexed winner,
    address indexed token,
    uint256[] tokenIds
  );
  
  event InstantWithdrawal(
    address indexed operator,
    address indexed from,
    address indexed token,
    uint256 amount,
    uint256 exitFee,
    uint256 sponsoredExitFee
  );
  
  event TimelockedWithdrawal(
    address indexed operator,
    address indexed from,
    address indexed token,
    uint256 amount,
    uint256 unlockTimestamp
  );
  
  event TimelockedWithdrawalSwept(
    address indexed operator,
    address indexed from,
    uint256 amount
  );

  event PrizeStrategyDetached();

  MappedSinglyLinkedList.Mapping internal _tokens;
  PrizeStrategyInterface public prizeStrategy;

  uint256 public maxExitFeeMantissa;
  uint256 public maxTimelockDuration;

  uint256 public timelockTotalSupply;
  mapping(address => uint256) internal timelockBalances;
  mapping(address => uint256) internal unlockTimestamps;

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
    _tokens.initialize(_controlledTokens);
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
    timelockBalances[operator] = timelockBalances[operator].sub(amount);
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
    _token().transferFrom(operator, address(this), amount);
    _supply(amount);

    prizeStrategy.afterDepositTo(to, amount, controlledToken, data);

    emit Deposited(operator, to, controlledToken, amount);
  }

  /// @notice Withdraw assets from the Prize Pool instantly.  A fairness fee may be charged for an early exit.
  /// @param from The address to redeem tokens from.
  /// @param amount The amount of tokens to redeem for assets.
  /// @param controlledToken The address of the token to redeem (i.e. ticket or sponsorship)
  /// @param sponsorAmount An optional amount of assets paid by the caller to cover exit fees
  /// @param maximumExitFee The maximum exit fee the caller is willing to pay.  This can be pre-calculated.
  /// @return exitFee The amount of the fairness fee paid
  function withdrawInstantlyFrom(
    address from,
    uint256 amount,
    address controlledToken,
    uint256 sponsorAmount,
    uint256 maximumExitFee,
    bytes calldata data
  )
    external
    nonReentrant
    onlyControlledToken(controlledToken)
    returns (uint256 exitFee)
  {

    if (_hasPrizeStrategy()) {
      exitFee = limitExitFee(amount, prizeStrategy.beforeWithdrawInstantlyFrom(from, amount, controlledToken, data));
    }

    uint256 maxFee = FixedPoint.multiplyUintByMantissa(amount, maxExitFeeMantissa);
    if (exitFee > maxFee) {
      exitFee = maxFee;
    }
    
    require(exitFee <= maximumExitFee, "PrizePool/exit-fee-exceeds-user-maximum");

    uint256 sponsoredExitFeePortion = (exitFee > sponsorAmount) ? sponsorAmount : exitFee;
    uint256 userExitFee = exitFee.sub(sponsoredExitFeePortion);

    if (sponsoredExitFeePortion > 0) {
      // transfer the fee to this contract
      _token().transferFrom(_msgSender(), address(this), sponsoredExitFeePortion);
    }

    // burn the tickets
    ControlledToken(controlledToken).controllerBurnFrom(_msgSender(), from, amount);

    // redeem the tickets less the fee
    uint256 amountLessFee = amount.sub(userExitFee);
    _redeem(amountLessFee);

    _token().transfer(from, amountLessFee);

    if (_hasPrizeStrategy()) {
      prizeStrategy.afterWithdrawInstantlyFrom(_msgSender(), from, amount, controlledToken, exitFee, sponsoredExitFeePortion, data);
    }

    emit InstantWithdrawal(_msgSender(), from, controlledToken, amount, exitFee, sponsoredExitFeePortion);
  }

  function limitExitFee(uint256 withdrawalAmount, uint256 exitFee) internal view returns (uint256) {
    uint256 maxFee = FixedPoint.multiplyUintByMantissa(withdrawalAmount, maxExitFeeMantissa);
    if (exitFee > maxFee) {
      exitFee = maxFee;
    }
    return exitFee;
  }

  /// @notice Withdraw assets from the Prize Pool by placing them into the timelock.
  /// @dev The timelock is used to ensure that the tickets have contributed their fair share of the prize.
  /// @param from The address to withdraw from
  /// @param amount The amount to withdraw
  /// @param controlledToken The type of token being withdrawn
  /// @return unlockTimestamp The timestamp after which the funds can be swept
  function withdrawWithTimelockFrom(
    address from,
    uint256 amount,
    address controlledToken,
    bytes calldata data
  )
    external
    nonReentrant
    onlyControlledToken(controlledToken)
    returns (uint256 unlockTimestamp)
  {
    uint256 blockTime = _currentTime();

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
    sweepTimelockBalances(users);

    timelockTotalSupply = timelockTotalSupply.add(amount);
    timelockBalances[user] = timelockBalances[user].add(amount);
    unlockTimestamps[user] = timestamp;

    // if the funds should already be unlocked
    if (timestamp <= _currentTime()) {
      sweepTimelockBalances(users);
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
  /// @return award The total amount of assets to be awarded for the current prize
  function awardBalance() public returns (uint256 award) {
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
  /// @param controlledToken The addess of the asset token being awarded
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
  /// @param externalToken The addess of the external asset token being awarded
  function awardExternalERC20(address to, address externalToken, uint256 amount) external onlyPrizeStrategy {
    require(_canAwardExternal(externalToken), "PrizePool/invalid-external-token");

    if (amount == 0) {
      return;
    }

    IERC20(externalToken).transfer(to, amount);

    emit AwardedExternalERC20(to, externalToken, amount);
  }

  /// @notice Called by the Prize-Strategy to Award Secondary (external) Prize NFTs to a specific account
  /// @dev Used to award any arbitrary NFTs held by the Prize Pool
  /// @param to The address of the winner that receives the award
  /// @param externalToken The addess of the external NFT token being awarded
  /// @param tokenIds An array of NFT Token IDs to be transferred
  function awardExternalERC721(address to, address externalToken, uint256[] calldata tokenIds) external onlyPrizeStrategy {
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

    IERC20 underlyingToken = IERC20(_token());
    uint256 i;
    for (i = 0; i < users.length; i++) {
      address user = users[i];
      if (unlockTimestamps[user] <= _currentTime()) {
        uint256 userBalance = timelockBalances[user];
        if (userBalance > 0) {
          timelockTotalSupply = timelockTotalSupply.sub(userBalance);
          delete timelockBalances[user];
          delete unlockTimestamps[user];
          underlyingToken.transfer(user, userBalance);
          emit TimelockedWithdrawalSwept(operator, user, userBalance);
        }
        changes[i] = BalanceChange(user, userBalance);
      } else {
        changes[i] = BalanceChange(user, 0);
      }
    }

    // Update prize strategy after sweep
    _updateAfterSweep(changes, operator);
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

  /// @dev Updates the Prize Strategy after a sweep has been performed on timelocked balances
  /// @param changes An array of user-balance changes
  /// @param operator The address of the operator performing the update
  function _updateAfterSweep(BalanceChange[] memory changes, address operator) internal {
    if (!_hasPrizeStrategy()) { return; }

    for (uint256 i = 0; i < changes.length; i++) {
      BalanceChange memory change = changes[i];
      if (change.balance > 0) {
        prizeStrategy.afterSweepTimelockedWithdrawal(operator, change.user, change.balance);
      }
    }
  }

  /// @notice Allows the Governor to add Controlled Tokens to the Prize Pool
  /// @param _controlledToken The address of the Controlled Token to add
  function addControlledToken(address _controlledToken) external onlyOwner {
    require(ControlledToken(_controlledToken).controller() == this, "PrizePool/token-ctrlr-mismatch");
    _tokens.addAddress(_controlledToken);
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
    address currentToken = _tokens.addressMap[MappedSinglyLinkedList.SENTINAL];
    while (currentToken != address(0) && currentToken != MappedSinglyLinkedList.SENTINAL) {
      total = total.add(IERC20(currentToken).totalSupply());
      currentToken = _tokens.addressMap[currentToken];
    }
  }

  /// @dev Checks if a specific token is controlled by the Prize Pool
  /// @param controlledToken The address of the token to check
  /// @return True if the token is a controlled token, false otherwise
  function isControlled(address controlledToken) internal view returns (bool) {
    return _tokens.contains(controlledToken);
  }

  function _msgSender() internal override(BaseRelayRecipient, ContextUpgradeSafe) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }

  /// @dev Function modifier to ensure usage of tokens controlled by the Prize Pool
  /// @param controlledToken The address of the token to check
  modifier onlyControlledToken(address controlledToken) {
    require(isControlled(controlledToken), "PrizePool/unknown-token");
    _;
  }

  /// @dev Function modifier to ensure caller is the prize-strategy
  modifier onlyPrizeStrategy() {
    require(msg.sender == address(prizeStrategy), "PrizePool/only-prizeStrategy");
    _;
  }
}
