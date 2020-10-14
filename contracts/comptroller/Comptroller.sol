// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";

import "../utils/UInt256Array.sol";
import "./ComptrollerStorage.sol";
import "../token/TokenListenerInterface.sol";

/// @title The Comptroller disburses rewards to pool users
/* solium-disable security/no-block-members */
contract Comptroller is ComptrollerStorage, TokenListenerInterface {
  using SafeMath for uint256;
  using SafeCast for uint256;
  using UInt256Array for uint256[];
  using ExtendedSafeCast for uint256;
  using BalanceDrip for BalanceDrip.State;
  using VolumeDrip for VolumeDrip.State;
  using BalanceDripManager for BalanceDripManager.State;
  using VolumeDripManager for VolumeDripManager.State;
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;

  /// @notice Emitted when a balance drip is actived
  event BalanceDripActivated(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    uint256 dripRatePerSecond
  );

  /// @notice Emitted when a balance drip is deactivated
  event BalanceDripDeactivated(
    address indexed source,
    address indexed measure,
    address indexed dripToken
  );

  /// @notice Emitted when a balance drip rate is updated
  event BalanceDripRateSet(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    uint256 dripRatePerSecond
  );

  /// @notice Emitted when a balance drip drips tokens
  event BalanceDripDripped(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    address user,
    uint256 amount
  );

  event DripTokenDripped(
    address indexed dripToken,
    address indexed user,
    uint256 amount
  );

  /// @notice Emitted when a volue drip drips tokens
  event VolumeDripDripped(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    bool isReferral,
    address user,
    uint256 amount
  );

  /// @notice Emitted when a user claims drip tokens
  event DripTokenClaimed(
    address indexed operator,
    address indexed dripToken,
    address indexed user,
    uint256 amount
  );

  /// @notice Emitted when a volume drip is activated
  event VolumeDripActivated(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    bool isReferral,
    uint256 periodSeconds,
    uint256 dripAmount
  );

  /// @notice Emitted when a new volume drip period has started
  event VolumeDripPeriodStarted(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    bool isReferral,
    uint32 period,
    uint256 dripAmount,
    uint256 endTime
  );

  /// @notice Emitted when a volume drip period has ended
  event VolumeDripPeriodEnded(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    bool isReferral,
    uint32 period,
    uint256 totalSupply
  );

  /// @notice Emitted when a volume drip is updated
  event VolumeDripSet(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    bool isReferral,
    uint256 periodSeconds,
    uint256 dripAmount
  );

  /// @notice Emitted when a volume drip is deactivated.
  event VolumeDripDeactivated(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    bool isReferral
  );

  /// @notice Convenience struct used when updating drips
  struct UpdatePair {
    address source;
    address measure;
  }

  /// @notice Convenience struct used to retrieve balances after updating drips
  struct DripTokenBalance {
    address dripToken;
    uint256 balance;
  }

  /// @notice Initializes a new Comptroller.
  constructor () public {
    __Ownable_init();
  }

  /// @notice Activates a balance drip.  Only callable by the owner.
  /// @param source The balance drip "source"; i.e. a Prize Pool address.
  /// @param measure The ERC20 token whose balances determines user's share of the drip rate.
  /// @param dripToken The token that is dripped to users.
  /// @param dripRatePerSecond The amount of drip tokens that are awarded each second to the total supply of measure.
  function activateBalanceDrip(address source, address measure, address dripToken, uint256 dripRatePerSecond) external onlyOwner {

    balanceDrips[source].activateDrip(measure, dripToken, dripRatePerSecond, _currentTime().toUint32());

    emit BalanceDripActivated(
      source,
      measure,
      dripToken,
      dripRatePerSecond
    );
  }

  /// @notice Deactivates a balance drip.  Only callable by the owner.
  /// @param source The balance drip "source"; i.e. a Prize Pool address.
  /// @param measure The ERC20 token whose balances determines user's share of the drip rate.
  /// @param dripToken The token that is dripped to users.
  /// @param prevDripToken The previous drip token in the balance drip list.  If the dripToken is the first address,
  /// then the previous address is the SENTINEL address: 0x0000000000000000000000000000000000000001
  function deactivateBalanceDrip(address source, address measure, address dripToken, address prevDripToken) external onlyOwner {
    _deactivateBalanceDrip(source, measure, dripToken, prevDripToken);
  }

  /// @notice Deactivates a balance drip.  Only callable by the owner.
  /// @param source The balance drip "source"; i.e. a Prize Pool address.
  /// @param measure The ERC20 token whose balances determines user's share of the drip rate.
  /// @param dripToken The token that is dripped to users.
  /// @param prevDripToken The previous drip token in the balance drip list.  If the dripToken is the first address,
  /// then the previous address is the SENTINEL address: 0x0000000000000000000000000000000000000001
  function _deactivateBalanceDrip(address source, address measure, address dripToken, address prevDripToken) internal {
    balanceDrips[source].deactivateDrip(measure, dripToken, prevDripToken, _currentTime().toUint32());

    emit BalanceDripDeactivated(source, measure, dripToken);
  }

  /// @notice Gets a list of active balance drip tokens
  /// @param source The balance drip "source"; i.e. a Prize Pool address.
  /// @param measure The ERC20 token whose balances determines user's share of the drip rate.
  /// @return An array of active Balance Drip token addresses
  function getActiveBalanceDripTokens(address source, address measure) external view returns (address[] memory) {
    return balanceDrips[source].getActiveBalanceDrips(measure);
  }

  /// @notice Returns the state of a balance drip.
  /// @param source The balance drip "source"; i.e. Prize Pool
  /// @param measure The token that measure's a users share of the drip
  /// @param dripToken The token that is being dripped to users
  /// @return dripRatePerSecond The current drip rate of the balance drip.
  /// @return exchangeRateMantissa The current exchange rate from measure to dripTokens
  /// @return timestamp The timestamp at which the balance drip was last updated.
  function getBalanceDrip(
    address source,
    address measure,
    address dripToken
  )
    external
    view
    returns (
      uint256 dripRatePerSecond,
      uint128 exchangeRateMantissa,
      uint32 timestamp
    )
  {
    BalanceDrip.State storage balanceDrip = balanceDrips[source].getDrip(measure, dripToken);
    dripRatePerSecond = balanceDrip.dripRatePerSecond;
    exchangeRateMantissa = balanceDrip.exchangeRateMantissa;
    timestamp = balanceDrip.timestamp;
  }

  /// @notice Sets the drip rate for a balance drip.  The drip rate is the number of drip tokens given to the
  /// entire supply of measure tokens.  Only callable by the owner.
  /// @param source The balance drip "source"; i.e. Prize Pool
  /// @param measure The token to use to measure a user's share of the drip rate
  /// @param dripToken The token that is dripped to the user
  /// @param dripRatePerSecond The new drip rate per second
  function setBalanceDripRate(address source, address measure, address dripToken, uint256 dripRatePerSecond) external onlyOwner {
    balanceDrips[source].setDripRate(measure, dripToken, dripRatePerSecond, _currentTime().toUint32());

    emit BalanceDripRateSet(
      source,
      measure,
      dripToken,
      dripRatePerSecond
    );
  }

  /// @notice Activates a volume drip.  Volume drips distribute tokens to users based on their share of the activity within a period.
  /// @param source The Prize Pool for which to bind to
  /// @param measure The Prize Pool controlled token whose volume should be measured
  /// @param dripToken The token that is being disbursed
  /// @param isReferral Whether this volume drip is for referrals
  /// @param periodSeconds The period of the volume drip, in seconds
  /// @param dripAmount The amount of dripTokens disbursed each period.
  /// @param endTime The time at which the first period ends.
  function activateVolumeDrip(
    address source,
    address measure,
    address dripToken,
    bool isReferral,
    uint32 periodSeconds,
    uint112 dripAmount,
    uint32 endTime
  )
    external
    onlyOwner
  {
    uint32 period;

    if (isReferral) {
      period = referralVolumeDrips[source].activate(measure, dripToken, periodSeconds, dripAmount, endTime);
    } else {
      period = volumeDrips[source].activate(measure, dripToken, periodSeconds, dripAmount, endTime);
    }

    emit VolumeDripActivated(
      source,
      measure,
      dripToken,
      isReferral,
      periodSeconds,
      dripAmount
    );

    emit VolumeDripPeriodStarted(
      source,
      measure,
      dripToken,
      isReferral,
      period,
      dripAmount,
      endTime
    );
  }

  /// @notice Deactivates a volume drip.  Volume drips distribute tokens to users based on their share of the activity within a period.
  /// @param source The Prize Pool for which to bind to
  /// @param measure The Prize Pool controlled token whose volume should be measured
  /// @param dripToken The token that is being disbursed
  /// @param isReferral Whether this volume drip is for referrals
  /// @param prevDripToken The previous drip token in the volume drip list.  Is different for referrals vs non-referral volume drips.
  function deactivateVolumeDrip(
    address source,
    address measure,
    address dripToken,
    bool isReferral,
    address prevDripToken
  )
    external
    onlyOwner
  {
    _deactivateVolumeDrip(source, measure, dripToken, isReferral, prevDripToken);
  }

  /// @notice Deactivates a volume drip.  Volume drips distribute tokens to users based on their share of the activity within a period.
  /// @param source The Prize Pool for which to bind to
  /// @param measure The Prize Pool controlled token whose volume should be measured
  /// @param dripToken The token that is being disbursed
  /// @param isReferral Whether this volume drip is for referrals
  /// @param prevDripToken The previous drip token in the volume drip list.  Is different for referrals vs non-referral volume drips.
  function _deactivateVolumeDrip(
    address source,
    address measure,
    address dripToken,
    bool isReferral,
    address prevDripToken
  )
    internal
  {
    if (isReferral) {
      referralVolumeDrips[source].deactivate(measure, dripToken, prevDripToken);
    } else {
      volumeDrips[source].deactivate(measure, dripToken, prevDripToken);
    }

    emit VolumeDripDeactivated(
      source,
      measure,
      dripToken,
      isReferral
    );
  }


  /// @notice Sets the parameters for the *next* volume drip period.  The source, measure, dripToken and isReferral combined
  /// are used to uniquely identify a volume drip.  Only callable by the owner.
  /// @param source The Prize Pool of the volume drip
  /// @param measure The token whose volume is being measured
  /// @param dripToken The token that is being disbursed
  /// @param isReferral Whether this volume drip is a referral
  /// @param periodSeconds The length to use for the next period
  /// @param dripAmount The amount of tokens to drip for the next period
  function setVolumeDrip(
    address source,
    address measure,
    address dripToken,
    bool isReferral,
    uint32 periodSeconds,
    uint112 dripAmount
  )
    external
    onlyOwner
  {
    if (isReferral) {
      referralVolumeDrips[source].set(measure, dripToken, periodSeconds, dripAmount);
    } else {
      volumeDrips[source].set(measure, dripToken, periodSeconds, dripAmount);
    }

    emit VolumeDripSet(
      source,
      measure,
      dripToken,
      isReferral,
      periodSeconds,
      dripAmount
    );
  }

  function getVolumeDrip(
    address source,
    address measure,
    address dripToken,
    bool isReferral
  )
    external
    view
    returns (
      uint256 periodSeconds,
      uint256 dripAmount,
      uint256 periodCount
    )
  {
    VolumeDrip.State memory drip;

    if (isReferral) {
      drip = referralVolumeDrips[source].volumeDrips[measure][dripToken];
    } else {
      drip = volumeDrips[source].volumeDrips[measure][dripToken];
    }

    return (
      drip.nextPeriodSeconds,
      drip.nextDripAmount,
      drip.periodCount
    );
  }

  /// @notice Gets a list of active volume drip tokens
  /// @param source The volume drip "source"; i.e. a Prize Pool address.
  /// @param measure The ERC20 token whose volume determines user's share of the drip rate.
  /// @param isReferral Whether this volume drip is a referral
  /// @return An array of active Volume Drip token addresses
  function getActiveVolumeDripTokens(address source, address measure, bool isReferral) external view returns (address[] memory) {
    if (isReferral) {
      return referralVolumeDrips[source].getActiveVolumeDrips(measure);
    } else {
      return volumeDrips[source].getActiveVolumeDrips(measure);
    }
  }

  function isVolumeDripActive(
    address source,
    address measure,
    address dripToken,
    bool isReferral
  )
    external
    view
    returns (bool)
  {
    if (isReferral) {
      return referralVolumeDrips[source].isActive(measure, dripToken);
    } else {
      return volumeDrips[source].isActive(measure, dripToken);
    }
  }

  function getVolumeDripPeriod(
    address source,
    address measure,
    address dripToken,
    bool isReferral,
    uint16 period
  )
    external
    view
    returns (
      uint112 totalSupply,
      uint112 dripAmount,
      uint32 endTime
    )
  {
    VolumeDrip.Period memory periodState;

    if (isReferral) {
      periodState = referralVolumeDrips[source].volumeDrips[measure][dripToken].periods[period];
    } else {
      periodState = volumeDrips[source].volumeDrips[measure][dripToken].periods[period];
    }

    return (
      periodState.totalSupply,
      periodState.dripAmount,
      periodState.endTime
    );
  }







  /// @notice Returns a users claimable balance of drip tokens.  This is the combination of all balance and volume drips.
  /// @param dripToken The token that is being disbursed
  /// @param user The user whose balance should be checked.
  /// @return The claimable balance of the dripToken by the user.
  function balanceOfDrip(address dripToken, address user) external view returns (uint256) {
    return dripTokenBalances[dripToken][user];
  }

  /// @notice Claims a drip token on behalf of a user.  If the passed amount is less than or equal to the users drip balance, then
  /// they will be transferred that amount.  Otherwise, it fails.
  /// @param user The user for whom to claim the drip tokens
  /// @param dripToken The drip token to claim
  /// @param amount The amount of drip token to claim
  function claimDrip(address user, address dripToken, uint256 amount) public {
    address sender = _msgSender();
    dripTokenTotalSupply[dripToken] = dripTokenTotalSupply[dripToken].sub(amount);
    dripTokenBalances[dripToken][user] = dripTokenBalances[dripToken][user].sub(amount);
    require(IERC20(dripToken).transfer(user, amount), "Comptroller/claim-transfer-failed");

    emit DripTokenClaimed(sender, dripToken, user, amount);
  }

  /// @notice Updates all drips. Drip may need to be "poked" from time-to-time if there is little transaction activity.  This call will
  /// poke all of the drips and update the claim balances for the given user.
  /// @dev This function will be useful to check the *current* claim balances for a user.
  /// Just need to run this as a constant function to see the latest balances.
  /// in order to claim the values, this function needs to be run alongside a claimDrip function.
  /// @param pairs The (source, measure) pairs to update.  For each pair all of the balance drips, volume drips, and referral volume drips will be updated.
  /// @param user The user whose drips and balances will be updated.
  /// @param dripTokens The drip tokens to retrieve claim balances for.
  /// @return The claimable balance of each of the passed drip tokens for the user.  These are the post-update balances, and therefore the most accurate.
  function updateDrips(
    UpdatePair[] memory pairs,
    address user,
    address[] memory dripTokens
  )
    public
    returns (DripTokenBalance[] memory)
  {
    uint256 currentTime = _currentTime();

    uint256 i;
    for (i = 0; i < pairs.length; i++) {
      UpdatePair memory pair = pairs[i];
      _updateBalanceDrips(
        balanceDrips[pair.source],
        pair.source,
        pair.measure,
        user,
        IERC20(pair.measure).balanceOf(user),
        IERC20(pair.measure).totalSupply(),
        currentTime
      );

      _depositVolumeDrip(
        volumeDrips[pair.source],
        pair.source,
        pair.measure,
        user,
        0,
        false
      );

      _depositVolumeDrip(
        referralVolumeDrips[pair.source],
        pair.source,
        pair.measure,
        user,
        0,
        true
      );
    }

    DripTokenBalance[] memory balances = new DripTokenBalance[](dripTokens.length);
    for (i = 0; i < dripTokens.length; i++) {
      balances[i] = DripTokenBalance({
        dripToken: dripTokens[i],
        balance: dripTokenBalances[dripTokens[i]][user]
      });
    }

    return balances;
  }

  /// @notice Updates the given drips for a user and then claims the given drip tokens
  /// @param pairs The (source, measure) pairs of drips to update for the given user
  /// @param user The user for whom to update and claim tokens
  /// @param dripTokens The drip tokens whose entire balance will be claimed after the update.
  function updateAndClaimDrips(
    UpdatePair[] calldata pairs,
    address user,
    address[] calldata dripTokens
  )
    external
  {
    DripTokenBalance[] memory _dripTokenBalances = updateDrips(pairs, user, dripTokens);
    for (uint256 i = 0; i < _dripTokenBalances.length; i++) {
      claimDrip(user, _dripTokenBalances[i].dripToken, _dripTokenBalances[i].balance);
    }
  }

  /// @notice Updates the balance drips
  /// @param source The Prize Pool of the balance drip
  /// @param manager The BalanceDripManager whose drips should be updated
  /// @param measure The measure token whose balance is changing
  /// @param user The user whose balance is changing
  /// @param measureBalance The users last balance of the measure tokens
  /// @param measureTotalSupply The last total supply of the measure tokens
  /// @param currentTime The current
  function _updateBalanceDrips(
    BalanceDripManager.State storage manager,
    address source,
    address measure,
    address user,
    uint256 measureBalance,
    uint256 measureTotalSupply,
    uint256 currentTime
  ) internal {
    address prevDripToken = manager.activeBalanceDrips[measure].end();
    address currentDripToken = manager.activeBalanceDrips[measure].start();
    while (currentDripToken != address(0) && currentDripToken != manager.activeBalanceDrips[measure].end()) {


      bool isDripComplete = _updateBalanceDripToken(
        manager,
        source,
        measure,
        currentDripToken,
        user,
        measureBalance,
        measureTotalSupply,
        currentTime
      );

      if (isDripComplete) {
        _deactivateBalanceDrip(source, measure, currentDripToken, prevDripToken);
      }

      prevDripToken = currentDripToken;
      currentDripToken = manager.activeBalanceDrips[measure].next(currentDripToken);
    }
  }

  /// @notice Records a deposit for a volume drip
  /// @param source The Prize Pool of the volume drip
  /// @param manager The VolumeDripManager containing the drips that need to be iterated through.
  /// @param isReferral Whether the passed manager contains referral volume drip
  /// @param measure The token that was deposited
  /// @param user The user that deposited measure tokens
  /// @param amount The amount that the user deposited.
  function _depositVolumeDrip(
    VolumeDripManager.State storage manager,
    address source,
    address measure,
    address user,
    uint256 amount,
    bool isReferral
  )
    internal
  {
    address prevDripToken = manager.activeVolumeDrips[measure].end();
    uint256 currentTime = _currentTime();
    address currentDripToken = manager.activeVolumeDrips[measure].start();
    while (currentDripToken != address(0) && currentDripToken != manager.activeVolumeDrips[measure].end()) {

      bool isDripComplete = _updateVolumeDripToken(
        manager,
        source,
        measure,
        currentDripToken,
        user,
        amount,
        currentTime,
        isReferral
      );

      if (isDripComplete) {
        _deactivateVolumeDrip(source, measure, currentDripToken, isReferral, prevDripToken);
      }

      prevDripToken = currentDripToken;
      currentDripToken = manager.activeVolumeDrips[measure].next(currentDripToken);
    }
  }


  function _updateBalanceDripToken(
    BalanceDripManager.State storage manager,
    address source,
    address measure,
    address dripToken,
    address user,
    uint256 measureBalance,
    uint256 measureTotalSupply,
    uint256 currentTime
  ) internal returns (bool) {

    BalanceDrip.State storage dripState = manager.balanceDrips[measure][dripToken];
    bool isActive = manager.activeBalanceDrips[measure].contains(dripToken);


    uint128 newTokens;
    if (isActive) {
      newTokens = dripState.drip(
        user,
        measureBalance,
        measureTotalSupply,
        currentTime
      );
    } else {
      newTokens = dripState.poke(
        user,
        measureBalance
      );
    }


    uint256 amountDripped;
    if (newTokens > 0) {
      amountDripped = _addDripBalance(dripToken, user, newTokens);
      emit BalanceDripDripped(source, measure, dripToken, user, newTokens);
    }

    return (amountDripped != newTokens);
  }

  function _updateVolumeDripToken(
    VolumeDripManager.State storage manager,
    address source,
    address measure,
    address dripToken,
    address user,
    uint256 amount,
    uint256 currentTime,
    bool isReferral
  )
    internal
    returns (bool)
  {

    VolumeDrip.State storage dripState = manager.volumeDrips[measure][dripToken];
    (uint256 newTokens, bool isNewPeriod) = dripState.mint(
      user,
      amount,
      currentTime
    );

    uint256 amountDripped;
    if (newTokens > 0) {
      amountDripped = _addDripBalance(dripToken, user, newTokens);
      emit VolumeDripDripped(source, measure, dripToken, isReferral, user, newTokens);
    }

    bool isActive = manager.activeVolumeDrips[measure].contains(dripToken);

    if (isActive && isNewPeriod) {
      uint16 lastPeriod = uint256(dripState.periodCount).sub(1).toUint16();
      emit VolumeDripPeriodEnded(
        source,
        measure,
        dripToken,
        isReferral,
        lastPeriod,
        dripState.periods[lastPeriod].totalSupply
      );
      emit VolumeDripPeriodStarted(
        source,
        measure,
        dripToken,
        isReferral,
        dripState.periodCount,
        dripState.periods[dripState.periodCount].dripAmount,
        dripState.periods[dripState.periodCount].endTime
      );
    }

    return (amountDripped != newTokens);
  }

  function _addDripBalance(address dripToken, address user, uint256 amount) internal returns (uint256) {
    uint256 comptrollerBalance = IERC20(dripToken).balanceOf(address(this));
    uint256 totalClaimable = dripTokenTotalSupply[dripToken];

    uint256 amountAvailable = (totalClaimable < comptrollerBalance) ? comptrollerBalance.sub(totalClaimable) : 0;
    if (amount > amountAvailable) {
      amount = amountAvailable;
    }


    dripTokenTotalSupply[dripToken] = dripTokenTotalSupply[dripToken].add(amount);
    dripTokenBalances[dripToken][user] = dripTokenBalances[dripToken][user].add(amount);

    emit DripTokenDripped(dripToken, user, amount);
    return amount;
  }

  /// @notice Called by a "source" (i.e. Prize Pool) when a user mints new "measure" tokens.
  /// @param to The user who is minting the tokens
  /// @param amount The amount of tokens they are minting
  /// @param measure The measure token they are minting
  /// @param referrer The user who referred the minting.
  function beforeTokenMint(
    address to,
    uint256 amount,
    address measure,
    address referrer
  )
    external
    override
  {


    address source = _msgSender();
    uint256 balance = IERC20(measure).balanceOf(to);
    uint256 totalSupply = IERC20(measure).totalSupply();


    _updateBalanceDrips(
      balanceDrips[source],
      source,
      measure,
      to,
      balance,
      totalSupply,
      _currentTime()
    );

    _depositVolumeDrip(
      volumeDrips[source],
      source,
      measure,
      to,
      amount,
      false
    );

    if (referrer != address(0)) {
      _depositVolumeDrip(
        referralVolumeDrips[source],
        source,
        measure,
        referrer,
        amount,
        true
      );
    }
  }

  /// @notice Called by a "source" (i.e. Prize Pool) when tokens change hands or are burned
  /// @param from The user who is sending the tokens
  /// @param to The user who is receiving the tokens
  /// @param amount The amount of tokens being transferred
  /// @param measure The measure token they are transferring
  function beforeTokenTransfer(
    address from,
    address to,
    uint256 amount,
    address measure
  )
    external
    override
  {


    if (from == address(0)) {
      // ignore minting
      return;
    }
    address source = _msgSender();
    uint256 totalSupply = IERC20(measure).totalSupply();


    uint256 fromBalance = IERC20(measure).balanceOf(from);
    _updateBalanceDrips(
      balanceDrips[source],
      source,
      measure,
      from,
      fromBalance, // we want the original balance
      totalSupply,
      _currentTime()
    );

    if (to != address(0)) {
      uint256 toBalance = IERC20(measure).balanceOf(to);
      _updateBalanceDrips(
        balanceDrips[source],
        source,
        measure,
        to,
        toBalance, // we want the original balance
        totalSupply,
        _currentTime()
      );
    }
  }

  /// @notice returns the current time.  Allows for override in testing.
  /// @return The current time (block.timestamp)
  function _currentTime() internal virtual view returns (uint256) {
    return block.timestamp;
  }

}
