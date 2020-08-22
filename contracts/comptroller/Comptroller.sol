pragma solidity ^0.6.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";

import "../utils/UInt256Array.sol";
import "./ComptrollerStorage.sol";
import "./ComptrollerInterface.sol";
import "../drip/DripManager.sol";

/// @title The Comptroller disburses rewards to pool users and captures reserve fees from Prize Pools.
/* solium-disable security/no-block-members */
contract Comptroller is ComptrollerStorage, ComptrollerInterface {
  using SafeMath for uint256;
  using SafeCast for uint256;
  using UInt256Array for uint256[];
  using ExtendedSafeCast for uint256;
  using BalanceDrip for BalanceDrip.State;
  using VolumeDrip for VolumeDrip.State;
  // using BalanceDripManager for BalanceDripManager.State;
  // using VolumeDripManager for VolumeDripManager.State;
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;

  /// @notice Emitted when the reserve rate mantissa is changed
  event ReserveRateMantissaSet(
    uint256 reserveRateMantissa
  );

  event SourceDripManagerAdded(
    address indexed source,
    address indexed dripManager
  );

  event SourceDripManagerRemoved(
    address indexed source,
    address indexed dripManager
  );

  event DripTokenDripped(
    address indexed dripToken,
    address indexed user,
    uint256 amount
  );

  /// @notice Emitted when a user claims drip tokens
  event DripTokenClaimed(
    address indexed operator,
    address indexed dripToken,
    address indexed user,
    uint256 amount
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
  /// @param _owner The address to set as the owner of the contract
  function initialize(address _owner) public initializer {
    __Ownable_init();
    transferOwnership(_owner);
  }

  /// @notice Returns the reserve rate mantissa.  This is a fixed point 18 number, like "Ether".  Pools will contribute this fraction of the interest they earn to the protocol.
  /// @return The current reserve rate mantissa
  function reserveRateMantissa() external view override returns (uint256) {
    return _reserveRateMantissa;
  }

  /// @notice Sets the reserve rate mantissa.  Only callable by the owner.
  /// @param __reserveRateMantissa The new reserve rate.  Must be less than or equal to 1.
  function setReserveRateMantissa(uint256 __reserveRateMantissa) external onlyOwner {
    require(__reserveRateMantissa <= 1 ether, "Comptroller/reserve-rate-lte-one");
    _reserveRateMantissa = __reserveRateMantissa;

    emit ReserveRateMantissaSet(_reserveRateMantissa);
  }

  function _addDripBalance(address dripToken, address user, uint256 amount) internal {
    if (amount == 0) {
      return;
    }

    dripTokenBalances[dripToken][user] = dripTokenBalances[dripToken][user].add(amount);

    emit DripTokenDripped(dripToken, user, amount);
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
    dripTokenBalances[dripToken][user] = dripTokenBalances[dripToken][user].sub(amount);
    require(IERC20(dripToken).transfer(user, amount), "Comptroller/claim-transfer-failed");

    emit DripTokenClaimed(sender, user, dripToken, amount);
  }

  function addSourceDripManager(address source, address dripManager) external onlyOwner {
    sourceDripManagers[source].addAddress(dripManager);

    emit SourceDripManagerAdded(source, dripManager);
  }

  function removeSourceDripManager(address source, address dripManager, address prevDripManager) external onlyOwner {
    sourceDripManagers[source].removeAddress(prevDripManager, dripManager);

    emit SourceDripManagerRemoved(source, dripManager);
  }



  /// @notice Updates all drips. Drip may need to be "poked" from time-to-time if there is little transaction activity.  This call will
  /// poke all of the drips and update the claim balances for the given user.
  /// @dev This function will be useful to check the *current* claim balances for a user.  Just need to run this as a constant function to see the latest balances.
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
    uint256 pairIndex;
    for (pairIndex = 0; pairIndex < pairs.length; pairIndex++) {
      UpdatePair memory pair = pairs[pairIndex];

      address currentDripManager = sourceDripManagers[pair.source].start();
      while (currentDripManager != sourceDripManagers[pair.source].end()) {
        DripManager.DrippedToken[] memory drips = DripManager(currentDripManager).update(
          user,
          pair.measure
        );
        for (uint256 dripIndex = 0; dripIndex < drips.length; dripIndex++) {
          _addDripBalance(drips[dripIndex].token, drips[dripIndex].user, drips[dripIndex].amount);
        }
      }
    }

    DripTokenBalance[] memory balances = new DripTokenBalance[](dripTokens.length);
    for (uint256 dripTokenIndex = 0; dripTokenIndex < dripTokens.length; dripTokenIndex++) {
      balances[dripTokenIndex] = DripTokenBalance({
        dripToken: dripTokens[dripTokenIndex],
        balance: dripTokenBalances[dripTokens[dripTokenIndex]][user]
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
    DripTokenBalance[] memory dripTokenBalances = updateDrips(pairs, user, dripTokens);
    for (uint256 i = 0; i < dripTokenBalances.length; i++) {
      claimDrip(user, dripTokenBalances[i].dripToken, dripTokenBalances[i].balance);
    }
  }

  /// @notice Called by a "source" (i.e. Prize Pool) when a user mints new "measure" tokens.  Separate from beforeTokenTransfer so that the referrer can be passed
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
    _beforeMeasureTokenTransfer(
      source,
      address(0),
      to,
      amount,
      measure,
      referrer
    );
  }

  /// @notice Called by a "source" (i.e. Prize Pool) when tokens change hands or are burned
  /// @param from The user who is sending the tokens
  /// @param to The user who is receiving the tokens
  /// @param amount The amount of tokens they are burning
  /// @param measure The measure token they are burning
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
    _beforeMeasureTokenTransfer(
      source,
      from,
      to,
      amount,
      measure,
      address(0)
    );
  }

  function _beforeMeasureTokenTransfer(
    address source,
    address from,
    address to,
    uint256 amount,
    address measure,
    address referrer
  )
    internal
  {
    address currentDripManager = sourceDripManagers[source].start();
    while (currentDripManager != sourceDripManagers[source].end()) {
      DripManager.DrippedToken[] memory drips = DripManager(currentDripManager).beforeMeasureTokenTransfer(
        from,
        to,
        amount,
        measure,
        referrer
      );
      for (uint256 i = 0; i < drips.length; i++) {
        _addDripBalance(drips[i].token, drips[i].user, drips[i].amount);
      }
    }
  }

  /// @notice returns the current time.  Allows for override in testing.
  /// @return The current time (block.timestamp)
  function _currentTime() internal virtual view returns (uint256) {
    return block.timestamp;
  }

}
