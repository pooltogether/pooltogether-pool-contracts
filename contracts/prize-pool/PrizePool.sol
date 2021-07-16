// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/SafeCastUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/introspection/ERC165CheckerUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "../external/compound/ICompLike.sol";
import "../registry/RegistryInterface.sol";
import "../reserve/ReserveInterface.sol";
import "../token/TokenListenerInterface.sol";
import "../token/TokenListenerLibrary.sol";
import "../token/ControlledToken.sol";
import "../token/TokenControllerInterface.sol";
import "../utils/MappedSinglyLinkedList.sol";
import "./PrizePoolInterface.sol";

/// @title Escrows assets and deposits them into a yield source.  Exposes interest to Prize Strategy.  Users deposit and withdraw from this contract to participate in Prize Pool.
/// @notice Accounting is managed using Controlled Tokens, whose mint and burn functions can only be called by this contract.
/// @dev Must be inherited to provide specific yield-bearing asset control, such as Compound cTokens
abstract contract PrizePool is PrizePoolInterface, OwnableUpgradeable, ReentrancyGuardUpgradeable, TokenControllerInterface, IERC721ReceiverUpgradeable {
  using SafeMathUpgradeable for uint256;
  using SafeCastUpgradeable for uint256;
  using SafeERC20Upgradeable for IERC20Upgradeable;
  using SafeERC20Upgradeable for IERC721Upgradeable;
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;
  using ERC165CheckerUpgradeable for address;

  /// @dev Emitted when an instance is initialized
  event Initialized(
    address reserveRegistry,
    uint256 maxExitFeeMantissa
  );

  /// @dev Event emitted when controlled token is added
  event ControlledTokenAdded(
    ControlledTokenInterface indexed token
  );

  /// @dev Emitted when reserve is captured.
  event ReserveFeeCaptured(
    uint256 amount
  );

  event AwardCaptured(
    uint256 amount
  );

  /// @dev Event emitted when assets are deposited
  event Deposited(
    address indexed operator,
    address indexed to,
    address indexed token,
    uint256 amount,
    address referrer
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

  /// @dev Event emitted when external ERC20s are transferred out
  event TransferredExternalERC20(
    address indexed to,
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
    uint256 redeemed,
    uint256 exitFee
  );

  event ReserveWithdrawal(
    address indexed to,
    uint256 amount
  );

  /// @dev Event emitted when the Liquidity Cap is set
  event LiquidityCapSet(
    uint256 liquidityCap
  );

  /// @dev Event emitted when the Credit plan is set
  event CreditPlanSet(
    address token,
    uint128 creditLimitMantissa,
    uint128 creditRateMantissa
  );

  /// @dev Event emitted when the Prize Strategy is set
  event PrizeStrategySet(
    address indexed prizeStrategy
  );

  /// @dev Emitted when credit is minted
  event CreditMinted(
    address indexed user,
    address indexed token,
    uint256 amount
  );

  /// @dev Emitted when credit is burned
  event CreditBurned(
    address indexed user,
    address indexed token,
    uint256 amount
  );

  /// @dev Emitted when there was an error thrown awarding an External ERC721
  event ErrorAwardingExternalERC721(bytes error);


  struct CreditPlan {
    uint128 creditLimitMantissa;
    uint128 creditRateMantissa;
  }

  struct CreditBalance {
    uint192 balance;
    uint32 timestamp;
    bool initialized;
  }

  /// @notice Semver Version
  string constant public VERSION = "3.4.1";

  /// @dev Reserve to which reserve fees are sent
  RegistryInterface public reserveRegistry;

  /// @dev An array of all the controlled tokens
  ControlledTokenInterface[] internal _tokens;

  /// @dev The Prize Strategy that this Prize Pool is bound to.
  TokenListenerInterface public prizeStrategy;

  /// @dev The maximum possible exit fee fraction as a fixed point 18 number.
  /// For example, if the maxExitFeeMantissa is "0.1 ether", then the maximum exit fee for a withdrawal of 100 Dai will be 10 Dai
  uint256 public maxExitFeeMantissa;

  /// @dev The total funds that have been allocated to the reserve
  uint256 public reserveTotalSupply;

  /// @dev The total amount of funds that the prize pool can hold.
  uint256 public liquidityCap;

  /// @dev the The awardable balance
  uint256 internal _currentAwardBalance;

  /// @dev Stores the credit plan for each token.
  mapping(address => CreditPlan) internal _tokenCreditPlans;

  /// @dev Stores each users balance of credit per token.
  mapping(address => mapping(address => CreditBalance)) internal _tokenCreditBalances;

  /// @notice Initializes the Prize Pool
  /// @param _controlledTokens Array of ControlledTokens that are controlled by this Prize Pool.
  /// @param _maxExitFeeMantissa The maximum exit fee size
  function initialize (
    RegistryInterface _reserveRegistry,
    ControlledTokenInterface[] memory _controlledTokens,
    uint256 _maxExitFeeMantissa
  )
    public
    initializer
  {
    require(address(_reserveRegistry) != address(0), "PrizePool/reserveRegistry-not-zero");
    uint256 controlledTokensLength = _controlledTokens.length;
    _tokens = new ControlledTokenInterface[](controlledTokensLength);

    for (uint256 i = 0; i < controlledTokensLength; i++) {
      ControlledTokenInterface controlledToken = _controlledTokens[i];
      _addControlledToken(controlledToken, i);
    }
    __Ownable_init();
    __ReentrancyGuard_init();
    _setLiquidityCap(uint256(-1));

    reserveRegistry = _reserveRegistry;
    maxExitFeeMantissa = _maxExitFeeMantissa;

    emit Initialized(
      address(_reserveRegistry),
      maxExitFeeMantissa
    );
  }

  /// @dev Returns the address of the underlying ERC20 asset
  /// @return The address of the asset
  function token() external override view returns (address) {
    return address(_token());
  }

  /// @dev Returns the total underlying balance of all assets. This includes both principal and interest.
  /// @return The underlying balance of assets
  function balance() external returns (uint256) {
    return _balance();
  }

  /// @dev Checks with the Prize Pool if a specific token type may be awarded as an external prize
  /// @param _externalToken The address of the token to check
  /// @return True if the token may be awarded, false otherwise
  function canAwardExternal(address _externalToken) external view returns (bool) {
    return _canAwardExternal(_externalToken);
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
    external override
    nonReentrant
    onlyControlledToken(controlledToken)
    canAddLiquidity(amount)
  {
    address operator = _msgSender();

    _mint(to, amount, controlledToken, referrer);

    _token().safeTransferFrom(operator, address(this), amount);
    _supply(amount);

    emit Deposited(operator, to, controlledToken, amount, referrer);
  }

  /// @notice Withdraw assets from the Prize Pool instantly.  A fairness fee may be charged for an early exit.
  /// @param from The address to redeem tokens from.
  /// @param amount The amount of tokens to redeem for assets.
  /// @param controlledToken The address of the token to redeem (i.e. ticket or sponsorship)
  /// @param maximumExitFee The maximum exit fee the caller is willing to pay.  This should be pre-calculated by the calculateExitFee() fxn.
  /// @return The actual exit fee paid
  function withdrawInstantlyFrom(
    address from,
    uint256 amount,
    address controlledToken,
    uint256 maximumExitFee
  )
    external override
    nonReentrant
    onlyControlledToken(controlledToken)
    returns (uint256)
  {
    (uint256 exitFee, uint256 burnedCredit) = _calculateEarlyExitFeeLessBurnedCredit(from, controlledToken, amount);
    require(exitFee <= maximumExitFee, "PrizePool/exit-fee-exceeds-user-maximum");

    // burn the credit
    _burnCredit(from, controlledToken, burnedCredit);

    // burn the tickets
    ControlledToken(controlledToken).controllerBurnFrom(_msgSender(), from, amount);

    // redeem the tickets less the fee
    uint256 amountLessFee = amount.sub(exitFee);
    uint256 redeemed = _redeem(amountLessFee);

    _token().safeTransfer(from, redeemed);

    emit InstantWithdrawal(_msgSender(), from, controlledToken, amount, redeemed, exitFee);

    return exitFee;
  }

  /// @notice Limits the exit fee to the maximum as hard-coded into the contract
  /// @param withdrawalAmount The amount that is attempting to be withdrawn
  /// @param exitFee The exit fee to check against the limit
  /// @return The passed exit fee if it is less than the maximum, otherwise the maximum fee is returned.
  function _limitExitFee(uint256 withdrawalAmount, uint256 exitFee) internal view returns (uint256) {
    uint256 maxFee = FixedPoint.multiplyUintByMantissa(withdrawalAmount, maxExitFeeMantissa);
    if (exitFee > maxFee) {
      exitFee = maxFee;
    }
    return exitFee;
  }

  /// @notice Updates the Prize Strategy when tokens are transferred between holders.
  /// @param from The address the tokens are being transferred from (0 if minting)
  /// @param to The address the tokens are being transferred to (0 if burning)
  /// @param amount The amount of tokens being trasferred
  function beforeTokenTransfer(address from, address to, uint256 amount) external override onlyControlledToken(msg.sender) {
    if (from != address(0)) {
      uint256 fromBeforeBalance = IERC20Upgradeable(msg.sender).balanceOf(from);
      // first accrue credit for their old balance
      uint256 newCreditBalance = _calculateCreditBalance(from, msg.sender, fromBeforeBalance, 0);

      if (from != to) {
        // if they are sending funds to someone else, we need to limit their accrued credit to their new balance
        newCreditBalance = _applyCreditLimit(msg.sender, fromBeforeBalance.sub(amount), newCreditBalance);
      }

      _updateCreditBalance(from, msg.sender, newCreditBalance);
    }
    if (to != address(0) && to != from) {
      _accrueCredit(to, msg.sender, IERC20Upgradeable(msg.sender).balanceOf(to), 0);
    }
    // if we aren't minting
    if (from != address(0) && address(prizeStrategy) != address(0)) {
      prizeStrategy.beforeTokenTransfer(from, to, amount, msg.sender);
    }
  }

  /// @notice Returns the balance that is available to award.
  /// @dev captureAwardBalance() should be called first
  /// @return The total amount of assets to be awarded for the current prize
  function awardBalance() external override view returns (uint256) {
    return _currentAwardBalance;
  }

  /// @notice Captures any available interest as award balance.
  /// @dev This function also captures the reserve fees.
  /// @return The total amount of assets to be awarded for the current prize
  function captureAwardBalance() external override nonReentrant returns (uint256) {
    uint256 tokenTotalSupply = _tokenTotalSupply();

    // it's possible for the balance to be slightly less due to rounding errors in the underlying yield source
    uint256 currentBalance = _balance();
    uint256 totalInterest = (currentBalance > tokenTotalSupply) ? currentBalance.sub(tokenTotalSupply) : 0;
    uint256 unaccountedPrizeBalance = (totalInterest > _currentAwardBalance) ? totalInterest.sub(_currentAwardBalance) : 0;

    if (unaccountedPrizeBalance > 0) {
      uint256 reserveFee = calculateReserveFee(unaccountedPrizeBalance);
      if (reserveFee > 0) {
        reserveTotalSupply = reserveTotalSupply.add(reserveFee);
        unaccountedPrizeBalance = unaccountedPrizeBalance.sub(reserveFee);
        emit ReserveFeeCaptured(reserveFee);
      }
      _currentAwardBalance = _currentAwardBalance.add(unaccountedPrizeBalance);

      emit AwardCaptured(unaccountedPrizeBalance);
    }

    return _currentAwardBalance;
  }

  function withdrawReserve(address to) external override onlyReserve returns (uint256) {

    uint256 amount = reserveTotalSupply;
    reserveTotalSupply = 0;
    uint256 redeemed = _redeem(amount);

    _token().safeTransfer(address(to), redeemed);

    emit ReserveWithdrawal(to, amount);

    return redeemed;
  }

  /// @notice Called by the prize strategy to award prizes.
  /// @dev The amount awarded must be less than the awardBalance()
  /// @param to The address of the winner that receives the award
  /// @param amount The amount of assets to be awarded
  /// @param controlledToken The address of the asset token being awarded
  function award(
    address to,
    uint256 amount,
    address controlledToken
  )
    external override
    onlyPrizeStrategy
    onlyControlledToken(controlledToken)
  {
    if (amount == 0) {
      return;
    }

    require(amount <= _currentAwardBalance, "PrizePool/award-exceeds-avail");
    _currentAwardBalance = _currentAwardBalance.sub(amount);

    _mint(to, amount, controlledToken, address(0));

    uint256 extraCredit = _calculateEarlyExitFeeNoCredit(controlledToken, amount);
    _accrueCredit(to, controlledToken, IERC20Upgradeable(controlledToken).balanceOf(to), extraCredit);

    emit Awarded(to, controlledToken, amount);
  }

  /// @notice Called by the Prize-Strategy to transfer out external ERC20 tokens
  /// @dev Used to transfer out tokens held by the Prize Pool.  Could be liquidated, or anything.
  /// @param to The address of the winner that receives the award
  /// @param amount The amount of external assets to be awarded
  /// @param externalToken The address of the external asset token being awarded
  function transferExternalERC20(
    address to,
    address externalToken,
    uint256 amount
  )
    external override
    onlyPrizeStrategy
  {
    if (_transferOut(to, externalToken, amount)) {
      emit TransferredExternalERC20(to, externalToken, amount);
    }
  }

  /// @notice Called by the Prize-Strategy to award external ERC20 prizes
  /// @dev Used to award any arbitrary tokens held by the Prize Pool
  /// @param to The address of the winner that receives the award
  /// @param amount The amount of external assets to be awarded
  /// @param externalToken The address of the external asset token being awarded
  function awardExternalERC20(
    address to,
    address externalToken,
    uint256 amount
  )
    external override
    onlyPrizeStrategy
  {
    if (_transferOut(to, externalToken, amount)) {
      emit AwardedExternalERC20(to, externalToken, amount);
    }
  }

  function _transferOut(
    address to,
    address externalToken,
    uint256 amount
  )
    internal
    returns (bool)
  {
    require(_canAwardExternal(externalToken), "PrizePool/invalid-external-token");

    if (amount == 0) {
      return false;
    }

    IERC20Upgradeable(externalToken).safeTransfer(to, amount);

    return true;
  }

  /// @notice Called to mint controlled tokens.  Ensures that token listener callbacks are fired.
  /// @param to The user who is receiving the tokens
  /// @param amount The amount of tokens they are receiving
  /// @param controlledToken The token that is going to be minted
  /// @param referrer The user who referred the minting
  function _mint(address to, uint256 amount, address controlledToken, address referrer) internal {
    if (address(prizeStrategy) != address(0)) {
      prizeStrategy.beforeTokenMint(to, amount, controlledToken, referrer);
    }
    ControlledToken(controlledToken).controllerMint(to, amount);
  }

  /// @notice Called by the prize strategy to award external ERC721 prizes
  /// @dev Used to award any arbitrary NFTs held by the Prize Pool
  /// @param to The address of the winner that receives the award
  /// @param externalToken The address of the external NFT token being awarded
  /// @param tokenIds An array of NFT Token IDs to be transferred
  function awardExternalERC721(
    address to,
    address externalToken,
    uint256[] calldata tokenIds
  )
    external override
    onlyPrizeStrategy
  {
    require(_canAwardExternal(externalToken), "PrizePool/invalid-external-token");

    if (tokenIds.length == 0) {
      return;
    }

    for (uint256 i = 0; i < tokenIds.length; i++) {
      try IERC721Upgradeable(externalToken).safeTransferFrom(address(this), to, tokenIds[i]){

      }
      catch(bytes memory error){
        emit ErrorAwardingExternalERC721(error);
      }
      
    }

    emit AwardedExternalERC721(to, externalToken, tokenIds);
  }

  /// @notice Calculates the reserve portion of the given amount of funds.  If there is no reserve address, the portion will be zero.
  /// @param amount The prize amount
  /// @return The size of the reserve portion of the prize
  function calculateReserveFee(uint256 amount) public view returns (uint256) {
    ReserveInterface reserve = ReserveInterface(reserveRegistry.lookup());
    if (address(reserve) == address(0)) {
      return 0;
    }
    uint256 reserveRateMantissa = reserve.reserveRateMantissa(address(this));
    if (reserveRateMantissa == 0) {
      return 0;
    }
    return FixedPoint.multiplyUintByMantissa(amount, reserveRateMantissa);
  }

  /// @notice Calculates the early exit fee for the given amount
  /// @param from The user who is withdrawing
  /// @param controlledToken The type of collateral being withdrawn
  /// @param amount The amount of collateral to be withdrawn
  /// @return exitFee The exit fee
  /// @return burnedCredit The user's credit that was burned
  function calculateEarlyExitFee(
    address from,
    address controlledToken,
    uint256 amount
  )
    external override
    returns (
      uint256 exitFee,
      uint256 burnedCredit
    )
  {
    (exitFee, burnedCredit) = _calculateEarlyExitFeeLessBurnedCredit(from, controlledToken, amount);
  }

  /// @dev Calculates the early exit fee for the given amount
  /// @param amount The amount of collateral to be withdrawn
  /// @return Exit fee
  function _calculateEarlyExitFeeNoCredit(address controlledToken, uint256 amount) internal view returns (uint256) {
    return _limitExitFee(
      amount,
      FixedPoint.multiplyUintByMantissa(amount, _tokenCreditPlans[controlledToken].creditLimitMantissa)
    );
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
    external override
    view
    returns (uint256 durationSeconds)
  {
    durationSeconds =_estimateCreditAccrualTime(
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
    uint256 accruedPerSecond = FixedPoint.multiplyUintByMantissa(_principal, _tokenCreditPlans[_controlledToken].creditRateMantissa);
    if (accruedPerSecond == 0) {
      return 0;
    }
    return _interest.div(accruedPerSecond);
  }

  /// @notice Burns a users credit.
  /// @param user The user whose credit should be burned
  /// @param credit The amount of credit to burn
  function _burnCredit(address user, address controlledToken, uint256 credit) internal {
    _tokenCreditBalances[controlledToken][user].balance = uint256(_tokenCreditBalances[controlledToken][user].balance).sub(credit).toUint128();

    emit CreditBurned(user, controlledToken, credit);
  }

  /// @notice Accrues ticket credit for a user assuming their current balance is the passed balance.  May burn credit if they exceed their limit.
  /// @param user The user for whom to accrue credit
  /// @param controlledToken The controlled token whose balance we are checking
  /// @param controlledTokenBalance The balance to use for the user
  /// @param extra Additional credit to be added
  function _accrueCredit(address user, address controlledToken, uint256 controlledTokenBalance, uint256 extra) internal {
    _updateCreditBalance(
      user,
      controlledToken,
      _calculateCreditBalance(user, controlledToken, controlledTokenBalance, extra)
    );
  }

  function _calculateCreditBalance(address user, address controlledToken, uint256 controlledTokenBalance, uint256 extra) internal view returns (uint256) {
    uint256 newBalance;
    CreditBalance storage creditBalance = _tokenCreditBalances[controlledToken][user];
    if (!creditBalance.initialized) {
      newBalance = 0;
    } else {
      uint256 credit = _calculateAccruedCredit(user, controlledToken, controlledTokenBalance);
      newBalance = _applyCreditLimit(controlledToken, controlledTokenBalance, uint256(creditBalance.balance).add(credit).add(extra));
    }
    return newBalance;
  }

  function _updateCreditBalance(address user, address controlledToken, uint256 newBalance) internal {
    uint256 oldBalance = _tokenCreditBalances[controlledToken][user].balance;

    _tokenCreditBalances[controlledToken][user] = CreditBalance({
      balance: newBalance.toUint128(),
      timestamp: _currentTime().toUint32(),
      initialized: true
    });

    if (oldBalance < newBalance) {
      emit CreditMinted(user, controlledToken, newBalance.sub(oldBalance));
    } 
    else if (newBalance < oldBalance) {
      emit CreditBurned(user, controlledToken, oldBalance.sub(newBalance));
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
      _tokenCreditPlans[controlledToken].creditLimitMantissa
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
  function _calculateAccruedCredit(address user, address controlledToken, uint256 controlledTokenBalance) internal view returns (uint256) {
    uint256 userTimestamp = _tokenCreditBalances[controlledToken][user].timestamp;

    if (!_tokenCreditBalances[controlledToken][user].initialized) {
      return 0;
    }

    uint256 deltaTime = _currentTime().sub(userTimestamp);
    uint256 deltaMantissa = deltaTime.mul(_tokenCreditPlans[controlledToken].creditRateMantissa);
    return FixedPoint.multiplyUintByMantissa(controlledTokenBalance, deltaMantissa);
  }

  /// @notice Returns the credit balance for a given user.  Not that this includes both minted credit and pending credit.
  /// @param user The user whose credit balance should be returned
  /// @return The balance of the users credit
  function balanceOfCredit(address user, address controlledToken) external override onlyControlledToken(controlledToken) returns (uint256) {
    _accrueCredit(user, controlledToken, IERC20Upgradeable(controlledToken).balanceOf(user), 0);
    return _tokenCreditBalances[controlledToken][user].balance;
  }

  /// @notice Sets the rate at which credit accrues per second.  The credit rate is a fixed point 18 number (like Ether).
  /// @param _controlledToken The controlled token for whom to set the credit plan
  /// @param _creditRateMantissa The credit rate to set.  Is a fixed point 18 decimal (like Ether).
  /// @param _creditLimitMantissa The credit limit to set.  Is a fixed point 18 decimal (like Ether).
  function setCreditPlanOf(
    address _controlledToken,
    uint128 _creditRateMantissa,
    uint128 _creditLimitMantissa
  )
    external override
    onlyControlledToken(_controlledToken)
    onlyOwner
  {
    _tokenCreditPlans[_controlledToken] = CreditPlan({
      creditLimitMantissa: _creditLimitMantissa,
      creditRateMantissa: _creditRateMantissa
    });

    emit CreditPlanSet(_controlledToken, _creditLimitMantissa, _creditRateMantissa);
  }

  /// @notice Returns the credit rate of a controlled token
  /// @param controlledToken The controlled token to retrieve the credit rates for
  /// @return creditLimitMantissa The credit limit fraction.  This number is used to calculate both the credit limit and early exit fee.
  /// @return creditRateMantissa The credit rate. This is the amount of tokens that accrue per second.
  function creditPlanOf(
    address controlledToken
  )
    external override
    view
    returns (
      uint128 creditLimitMantissa,
      uint128 creditRateMantissa
    )
  {
    creditLimitMantissa = _tokenCreditPlans[controlledToken].creditLimitMantissa;
    creditRateMantissa = _tokenCreditPlans[controlledToken].creditRateMantissa;
  }

  /// @notice Calculate the early exit for a user given a withdrawal amount.  The user's credit is taken into account.
  /// @param from The user who is withdrawing
  /// @param controlledToken The token they are withdrawing
  /// @param amount The amount of funds they are withdrawing
  /// @return earlyExitFee The additional exit fee that should be charged.
  /// @return creditBurned The amount of credit that will be burned
  function _calculateEarlyExitFeeLessBurnedCredit(
    address from,
    address controlledToken,
    uint256 amount
  )
    internal
    returns (
      uint256 earlyExitFee,
      uint256 creditBurned
    )
  {
    uint256 controlledTokenBalance = IERC20Upgradeable(controlledToken).balanceOf(from);
    require(controlledTokenBalance >= amount, "PrizePool/insuff-funds");
    _accrueCredit(from, controlledToken, controlledTokenBalance, 0);
    /*
    The credit is used *last*.  Always charge the fees up-front.

    How to calculate:

    Calculate their remaining exit fee.  I.e. full exit fee of their balance less their credit.

    If the exit fee on their withdrawal is greater than the remaining exit fee, then they'll have to pay the difference.
    */

    // Determine available usable credit based on withdraw amount
    uint256 remainingExitFee = _calculateEarlyExitFeeNoCredit(controlledToken, controlledTokenBalance.sub(amount));

    uint256 availableCredit;
    if (_tokenCreditBalances[controlledToken][from].balance >= remainingExitFee) {
      availableCredit = uint256(_tokenCreditBalances[controlledToken][from].balance).sub(remainingExitFee);
    }

    // Determine amount of credit to burn and amount of fees required
    uint256 totalExitFee = _calculateEarlyExitFeeNoCredit(controlledToken, amount);
    creditBurned = (availableCredit > totalExitFee) ? totalExitFee : availableCredit;
    earlyExitFee = totalExitFee.sub(creditBurned);
  }

  /// @notice Allows the Governor to set a cap on the amount of liquidity that he pool can hold
  /// @param _liquidityCap The new liquidity cap for the prize pool
  function setLiquidityCap(uint256 _liquidityCap) external override onlyOwner {
    _setLiquidityCap(_liquidityCap);
  }

  function _setLiquidityCap(uint256 _liquidityCap) internal {
    liquidityCap = _liquidityCap;
    emit LiquidityCapSet(_liquidityCap);
  }

  /// @notice Adds a new controlled token
  /// @param _controlledToken The controlled token to add.
  /// @param index The index to add the controlledToken
  function _addControlledToken(ControlledTokenInterface _controlledToken, uint256 index) internal {
    require(_controlledToken.controller() == this, "PrizePool/token-ctrlr-mismatch");
    
    _tokens[index] = _controlledToken;
    emit ControlledTokenAdded(_controlledToken);
  }

  /// @notice Sets the prize strategy of the prize pool.  Only callable by the owner.
  /// @param _prizeStrategy The new prize strategy
  function setPrizeStrategy(TokenListenerInterface _prizeStrategy) external override onlyOwner {
    _setPrizeStrategy(_prizeStrategy);
  }

  /// @notice Sets the prize strategy of the prize pool.  Only callable by the owner.
  /// @param _prizeStrategy The new prize strategy
  function _setPrizeStrategy(TokenListenerInterface _prizeStrategy) internal {
    require(address(_prizeStrategy) != address(0), "PrizePool/prizeStrategy-not-zero");
    require(address(_prizeStrategy).supportsInterface(TokenListenerLibrary.ERC165_INTERFACE_ID_TOKEN_LISTENER), "PrizePool/prizeStrategy-invalid");
    prizeStrategy = _prizeStrategy;

    emit PrizeStrategySet(address(_prizeStrategy));
  }

  /// @notice An array of the Tokens controlled by the Prize Pool (ie. Tickets, Sponsorship)
  /// @return An array of controlled token addresses
  function tokens() external override view returns (ControlledTokenInterface[] memory) {
    return _tokens;
  }

  /// @dev Gets the current time as represented by the current block
  /// @return The timestamp of the current block
  function _currentTime() internal virtual view returns (uint256) {
    return block.timestamp;
  }

  /// @notice The total of all controlled tokens
  /// @return The current total of all tokens
  function accountedBalance() external override view returns (uint256) {
    return _tokenTotalSupply();
  }

  /// @notice Delegate the votes for a Compound COMP-like token held by the prize pool
  /// @param compLike The COMP-like token held by the prize pool that should be delegated
  /// @param to The address to delegate to 
  function compLikeDelegate(ICompLike compLike, address to) external onlyOwner {
    if (compLike.balanceOf(address(this)) > 0) {
      compLike.delegate(to);
    }
  }
  
  /// @notice Required for ERC721 safe token transfers from smart contracts.
  /// @param operator The address that acts on behalf of the owner
  /// @param from The current owner of the NFT
  /// @param tokenId The NFT to transfer
  /// @param data Additional data with no specified format, sent in call to `_to`.
  function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external override returns (bytes4){
    return IERC721ReceiverUpgradeable.onERC721Received.selector;
  }

  /// @notice The total of all controlled tokens
  /// @return The current total of all tokens
  function _tokenTotalSupply() internal view returns (uint256) {
    uint256 total = reserveTotalSupply;
    ControlledTokenInterface[] memory tokens = _tokens; // SLOAD  
    uint256 tokensLength = tokens.length;
    
    for(uint256 i = 0; i < tokensLength; i++){
      total = total.add(IERC20Upgradeable(tokens[i]).totalSupply());
    }

    return total;
  }

  /// @dev Checks if the Prize Pool can receive liquidity based on the current cap
  /// @param _amount The amount of liquidity to be added to the Prize Pool
  /// @return True if the Prize Pool can receive the specified amount of liquidity
  function _canAddLiquidity(uint256 _amount) internal view returns (bool) {
    uint256 tokenTotalSupply = _tokenTotalSupply();
    return (tokenTotalSupply.add(_amount) <= liquidityCap);
  }

  /// @dev Checks if a specific token is controlled by the Prize Pool
  /// @param controlledToken The address of the token to check
  /// @return True if the token is a controlled token, false otherwise
  function _isControlled(ControlledTokenInterface controlledToken) internal view returns (bool) {
    ControlledTokenInterface[] memory tokens = _tokens; // SLOAD
    uint256 tokensLength = tokens.length;

    for(uint256 i = 0; i < tokensLength; i++) {
      if(tokens[i] == controlledToken) return true;
    }
    return false;
  }
  
  /// @dev Checks if a specific token is controlled by the Prize Pool
  /// @param controlledToken The address of the token to check
  /// @return True if the token is a controlled token, false otherwise
  function isControlled(ControlledTokenInterface controlledToken) external view returns (bool) {
    return _isControlled(controlledToken);
  }

  /// @notice Determines whether the passed token can be transferred out as an external award.
  /// @dev Different yield sources will hold the deposits as another kind of token: such a Compound's cToken.  The
  /// prize strategy should not be allowed to move those tokens.
  /// @param _externalToken The address of the token to check
  /// @return True if the token may be awarded, false otherwise
  function _canAwardExternal(address _externalToken) internal virtual view returns (bool);

  /// @notice Returns the ERC20 asset token used for deposits.
  /// @return The ERC20 asset token
  function _token() internal virtual view returns (IERC20Upgradeable);

  /// @notice Returns the total balance (in asset tokens).  This includes the deposits and interest.
  /// @return The underlying balance of asset tokens
  function _balance() internal virtual returns (uint256);

  /// @notice Supplies asset tokens to the yield source.
  /// @param mintAmount The amount of asset tokens to be supplied
  function _supply(uint256 mintAmount) internal virtual;

  /// @notice Redeems asset tokens from the yield source.
  /// @param redeemAmount The amount of yield-bearing tokens to be redeemed
  /// @return The actual amount of tokens that were redeemed.
  function _redeem(uint256 redeemAmount) internal virtual returns (uint256);

  /// @dev Function modifier to ensure usage of tokens controlled by the Prize Pool
  /// @param controlledToken The address of the token to check
  modifier onlyControlledToken(address controlledToken) {
    require(_isControlled(ControlledTokenInterface(controlledToken)), "PrizePool/unknown-token");
    _;
  }

  /// @dev Function modifier to ensure caller is the prize-strategy
  modifier onlyPrizeStrategy() {
    require(_msgSender() == address(prizeStrategy), "PrizePool/only-prizeStrategy");
    _;
  }

  /// @dev Function modifier to ensure the deposit amount does not exceed the liquidity cap (if set)
  modifier canAddLiquidity(uint256 _amount) {
    require(_canAddLiquidity(_amount), "PrizePool/exceeds-liquidity-cap");
    _;
  }

  modifier onlyReserve() {
    ReserveInterface reserve = ReserveInterface(reserveRegistry.lookup());
    require(address(reserve) == msg.sender, "PrizePool/only-reserve");
    _;
  }
}
