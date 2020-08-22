pragma solidity ^0.6.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

import "../utils/MappedSinglyLinkedList.sol";
import "./DripManager.sol";
import "./VolumeDrip.sol";

/// @title Manages the active set of Volume Drips.
/* solium-disable security/no-block-members */
contract VolumeDripManager is OwnableUpgradeSafe, DripManager {
  using SafeMath for uint256;
  using SafeCast for uint256;
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;
  using VolumeDrip for VolumeDrip.State;

  /// @notice Emitted when a volue drip drips tokens
  event VolumeDripDripped(
    address indexed measure,
    address indexed dripToken,
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
    address indexed measure,
    address indexed dripToken,
    uint256 periodSeconds,
    uint256 dripAmount
  );

  /// @notice Emitted when a new volume drip period has started
  event VolumeDripPeriodStarted(
    address indexed measure,
    address indexed dripToken,
    uint32 period,
    uint256 dripAmount,
    uint256 endTime
  );

  /// @notice Emitted when a volume drip period has ended
  event VolumeDripPeriodEnded(
    address indexed measure,
    address indexed dripToken,
    uint32 period,
    uint256 totalSupply
  );

  /// @notice Emitted when a user deposit triggers a volume drip update
  event VolumeDripDeposited(
    address indexed measure,
    address indexed dripToken,
    address user,
    uint256 amount,
    uint256 balance,
    uint256 accrued
  );

  /// @notice Emitted when a volume drip is updated
  event VolumeDripSet(
    address indexed measure,
    address indexed dripToken,
    uint256 periodSeconds,
    uint256 dripAmount
  );

  /// @notice Emitted when a volume drip is deactivated.
  event VolumeDripDeactivated(
    address indexed measure,
    address indexed dripToken
  );

  address comptroller;
  bool public isReferral;
  mapping(address => MappedSinglyLinkedList.Mapping) activeVolumeDrips;
  mapping(address => mapping(address => VolumeDrip.State)) volumeDrips;

  /// @notice Activates a volume drip.  Volume drips distribute tokens to users based on their share of the activity within a period.
  /// @param measure The Prize Pool controlled token whose volume should be measured
  /// @param dripToken The token that is being disbursed
  /// @param periodSeconds The period of the volume drip, in seconds
  /// @param dripAmount The amount of dripTokens disbursed each period.
  /// @param endTime The time at which the first period ends.
  function activateVolumeDrip(
    address measure,
    address dripToken,
    uint32 periodSeconds,
    uint112 dripAmount,
    uint32 endTime
  )
    external
    onlyOwner
  {
    require(!activeVolumeDrips[measure].contains(dripToken), "VolumeDripManager/drip-active");
    if (activeVolumeDrips[measure].count == 0) {
      activeVolumeDrips[measure].initialize();
    }
    activeVolumeDrips[measure].addAddress(dripToken);
    volumeDrips[measure][dripToken].setNewPeriod(periodSeconds, dripAmount, endTime);

    uint32 period = volumeDrips[measure][dripToken].periodCount;

    emit VolumeDripActivated(
      measure,
      dripToken,
      periodSeconds,
      dripAmount
    );

    emit VolumeDripPeriodStarted(
      measure,
      dripToken,
      period,
      dripAmount,
      endTime
    );
  }

  /// @notice Deactivates a volume drip.  Volume drips distribute tokens to users based on their share of the activity within a period.
  /// @param measure The Prize Pool controlled token whose volume should be measured
  /// @param dripToken The token that is being disbursed
  /// @param prevDripToken The previous drip token in the volume drip list.  Is different for referrals vs non-referral volume drips.
  function deactivateVolumeDrip(
    address measure,
    address dripToken,
    address prevDripToken
  )
    external
    onlyOwner
  {
    activeVolumeDrips[measure].removeAddress(prevDripToken, dripToken);

    emit VolumeDripDeactivated(
      measure,
      dripToken
    );
  }

  /// @notice Sets the parameters for the *next* volume drip period.  The source, measure, dripToken and isReferral combined are used to uniquely identify a volume drip.  Only callable by the owner.
  /// @param measure The token whose volume is being measured
  /// @param dripToken The token that is being disbursed
  /// @param periodSeconds The length to use for the next period
  /// @param dripAmount The amount of tokens to drip for the next period
  function setVolumeDrip(
    address measure,
    address dripToken,
    uint32 periodSeconds,
    uint112 dripAmount
  )
    external
    onlyOwner
  {
    require(activeVolumeDrips[measure].contains(dripToken), "VolumeDripManager/drip-not-active");
    volumeDrips[measure][dripToken].setNextPeriod(periodSeconds, dripAmount);

    emit VolumeDripSet(
      measure,
      dripToken,
      periodSeconds,
      dripAmount
    );
  }

  function getVolumeDrip(
    address measure,
    address dripToken
  )
    external
    view
    returns (
      uint256 periodSeconds,
      uint256 dripAmount,
      uint256 periodCount
    )
  {
    VolumeDrip.State memory drip = volumeDrips[measure][dripToken];

    return (
      drip.periodSeconds,
      drip.dripAmount,
      drip.periodCount
    );
  }

  function isVolumeDripActive(
    address measure,
    address dripToken
  )
    external
    view
    returns (bool)
  {
    return activeVolumeDrips[measure].contains(dripToken);
  }

  function getVolumeDripPeriod(
    address measure,
    address dripToken,
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
    VolumeDrip.Period memory periodState = volumeDrips[measure][dripToken].periods[period];

    return (
      periodState.totalSupply,
      periodState.dripAmount,
      periodState.endTime
    );
  }

  /// @notice Records a deposit for a volume drip
  /// @param measure The token that was deposited
  /// @param user The user that deposited measure tokens
  /// @param amount The amount that the user deposited.
  function _depositVolumeDrip(
    address measure,
    address user,
    uint256 amount
  )
    internal
    returns (DrippedToken[] memory, uint256 count)
  {
    DrippedToken[] memory result = new DrippedToken[](activeVolumeDrips[measure].count);

    uint256 currentTime = _currentTime();
    address currentDripToken = activeVolumeDrips[measure].start();
    while (currentDripToken != address(0) && currentDripToken != activeVolumeDrips[measure].end()) {
      VolumeDrip.State storage dripState = volumeDrips[measure][currentDripToken];
      (uint256 newTokens, bool isNewPeriod) = dripState.mint(
        user,
        amount,
        currentTime
      );

      if (newTokens > 0) {
        result[count++] = DrippedToken({
          user: user,
          token: currentDripToken,
          amount: newTokens
        });
        emit VolumeDripDripped(measure, currentDripToken, user, newTokens);
      }

      if (isNewPeriod) {
        uint16 lastPeriod = uint256(dripState.periodCount).sub(1).toUint16();
        emit VolumeDripPeriodEnded(
          measure,
          currentDripToken,
          lastPeriod,
          dripState.periods[lastPeriod].totalSupply
        );
        emit VolumeDripPeriodStarted(
          measure,
          currentDripToken,
          dripState.periodCount,
          dripState.periods[dripState.periodCount].dripAmount,
          dripState.periods[dripState.periodCount].endTime
        );
      }

      currentDripToken = activeVolumeDrips[measure].next(currentDripToken);
    }

    return (result, count);
  }

  function beforeMeasureTokenTransfer(
    address from,
    address to,
    uint256 amount,
    address measure,
    address referrer
  ) external virtual override returns (DrippedToken[] memory) {
    DrippedToken[] memory drips;
    uint256 count;

    // If we are minting
    if (from == address(0)) {
      if (isReferral) {
        (drips, count) = _depositVolumeDrip(measure, referrer, amount);
      } else {
        (drips, count) = _depositVolumeDrip(measure, to, amount);
      }
    }

    return drips;
  }

  function update(
    address to,
    address measure
  ) external override returns (DrippedToken[] memory) {
    DrippedToken[] memory drips;
    return drips;
  }

  modifier onlyComptroller() {
    require(msg.sender == comptroller, "BalanceDripManager/only-comptroller");
    _;
  }

  /// @notice returns the current time.  Allows for override in testing.
  /// @return The current time (block.timestamp)
  function _currentTime() internal virtual view returns (uint256) {
    return block.timestamp;
  }

}
