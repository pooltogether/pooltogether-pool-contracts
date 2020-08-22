pragma solidity ^0.6.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

import "../utils/ExtendedSafeCast.sol";
import "../utils/MappedSinglyLinkedList.sol";
import "./BalanceDrip.sol";
import "./DripManager.sol";

/// @title Manages the lifecycle of a set of Balance Drips.
/* solium-disable security/no-block-members */
contract BalanceDripManager is OwnableUpgradeSafe, DripManager {
  using SafeMath for uint256;
  using SafeCast for uint256;
  using ExtendedSafeCast for uint256;
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;
  using BalanceDrip for BalanceDrip.State;

  /// @notice Emitted when a balance drip is actived
  event BalanceDripActivated(
    address indexed measure,
    address indexed dripToken,
    uint256 dripRatePerSecond
  );

  /// @notice Emitted when a balance drip is deactivated
  event BalanceDripDeactivated(
    address indexed measure,
    address indexed dripToken
  );

  /// @notice Emitted when a balance drip rate is updated
  event BalanceDripRateSet(
    address indexed measure,
    address indexed dripToken,
    uint256 dripRatePerSecond
  );

  /// @notice Emitted when a balance drip drips tokens
  event BalanceDripDripped(
    address indexed measure,
    address indexed dripToken,
    address indexed user,
    uint256 amount
  );

  address comptroller;
  mapping(address => MappedSinglyLinkedList.Mapping) activeBalanceDrips;
  mapping(address => mapping(address => BalanceDrip.State)) balanceDrips;

  /// @notice Activates a balance drip.  Only callable by the owner.
  /// @param measure The ERC20 token whose balances determines user's share of the drip rate.
  /// @param dripToken The token that is dripped to users.
  /// @param dripRatePerSecond The amount of drip tokens that are awarded each second to the total supply of measure.
  function activateBalanceDrip(address measure, address dripToken, uint256 dripRatePerSecond) external onlyOwner {
    require(!activeBalanceDrips[measure].contains(dripToken), "BalanceDripManager/drip-active");
    if (activeBalanceDrips[measure].count == 0) {
      activeBalanceDrips[measure].initialize();
    }
    activeBalanceDrips[measure].addAddress(dripToken);
    balanceDrips[measure][dripToken].setDripRate(IERC20(measure).totalSupply(), dripRatePerSecond, _currentTime().toUint32());

    emit BalanceDripActivated(
      measure,
      dripToken,
      dripRatePerSecond
    );
  }

  /// @notice Deactivates a balance drip.  Only callable by the owner.
  /// @param measure The ERC20 token whose balances determines user's share of the drip rate.
  /// @param dripToken The token that is dripped to users.
  /// @param prevDripToken The previous drip token in the balance drip list.  If the dripToken is the first address, then the previous address is the SENTINEL address: 0x0000000000000000000000000000000000000001
  function deactivateBalanceDrip(address measure, address dripToken, address prevDripToken) external onlyOwner {
    activeBalanceDrips[measure].removeAddress(prevDripToken, dripToken);
    balanceDrips[measure][dripToken].setDripRate(IERC20(measure).totalSupply(), 0, _currentTime().toUint32());

    emit BalanceDripDeactivated(measure, dripToken);
  }

  /// @notice Returns the state of a balance drip.
  /// @param measure The token that measure's a users share of the drip
  /// @param dripToken The token that is being dripped to users
  /// @return dripRatePerSecond The current drip rate of the balance drip.
  /// @return exchangeRateMantissa The current exchange rate from measure to dripTokens
  /// @return timestamp The timestamp at which the balance drip was last updated.
  function getBalanceDrip(
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
    BalanceDrip.State storage balanceDrip = balanceDrips[measure][dripToken];
    dripRatePerSecond = balanceDrip.dripRatePerSecond;
    exchangeRateMantissa = balanceDrip.exchangeRateMantissa;
    timestamp = balanceDrip.timestamp;
  }

  /// @notice Sets the drip rate for a balance drip.  The drip rate is the number of drip tokens given to the entire supply of measure tokens.  Only callable by the owner.
  /// @param measure The token to use to measure a user's share of the drip rate
  /// @param dripToken The token that is dripped to the user
  /// @param dripRatePerSecond The new drip rate per second
  function setBalanceDripRate(address measure, address dripToken, uint256 dripRatePerSecond) external onlyOwner {
    require(activeBalanceDrips[measure].contains(dripToken), "BalanceDripManager/drip-not-active");
    balanceDrips[measure][dripToken].setDripRate(IERC20(measure).totalSupply(), dripRatePerSecond, _currentTime().toUint32());

    emit BalanceDripRateSet(
      measure,
      dripToken,
      dripRatePerSecond
    );
  }

  /// @notice Updates the balance drips
  /// @param measure The measure token whose balance is changing
  /// @param user The user whose balance is changing
  /// @param measureBalance The users last balance of the measure tokens
  /// @param measureTotalSupply The last total supply of the measure tokens
  /// @param currentTime The current
  function _updateBalanceDrips(
    address measure,
    address user,
    uint256 measureBalance,
    uint256 measureTotalSupply,
    uint256 currentTime
  ) internal returns (DrippedToken[] memory, uint256 count) {
    DrippedToken[] memory result = new DrippedToken[](activeBalanceDrips[measure].count);
    address currentDripToken = activeBalanceDrips[measure].start();
    while (currentDripToken != address(0) && currentDripToken != activeBalanceDrips[measure].end()) {
      BalanceDrip.State storage dripState = balanceDrips[measure][currentDripToken];
      uint128 newTokens = dripState.drip(
        user,
        measureBalance,
        measureTotalSupply,
        currentTime
      );
      if (newTokens > 0) {
        result[count++] = DrippedToken({
          user: user,
          token: currentDripToken,
          amount: newTokens
        });
        emit BalanceDripDripped(measure, currentDripToken, user, newTokens);
      }
      currentDripToken = activeBalanceDrips[measure].next(currentDripToken);
    }

    return (result, count);
  }

  function beforeMeasureTokenTransfer(
    address from,
    address to,
    uint256 amount,
    address measure,
    address referrer
  ) external override returns (DrippedToken[] memory) {
    uint256 measureTotalSupply = IERC20(measure).totalSupply();
    uint32 currentTime = _currentTime().toUint32();

    DrippedToken[] memory fromDrips;
    uint256 fromCount;

    if (from != address(0)) {
      (fromDrips, fromCount) = _updateBalanceDrips(
        measure, from, IERC20(measure).balanceOf(from), measureTotalSupply, currentTime
      );
    }

    DrippedToken[] memory toDrips;
    uint256 toCount;

    if (to != address(0)) {
      (toDrips, toCount) = _updateBalanceDrips(
        measure, to, IERC20(measure).balanceOf(to), measureTotalSupply, currentTime
      );
    }

    DrippedToken[] memory allDrips = new DrippedToken[](fromCount.add(toCount));
    uint256 i;
    for (i = 0; i < fromCount; i++) {
      allDrips[i] = fromDrips[i];
    }
    for (i = 0; i < toCount; i++) {
      allDrips[i.add(fromCount)] = toDrips[i];
    }
    return allDrips;
  }

  function update(
    address to,
    address measure
  ) external override returns (DrippedToken[] memory) {
    (DrippedToken[] memory drips,) = _updateBalanceDrips(
      measure, to, IERC20(measure).balanceOf(to), IERC20(measure).totalSupply(), _currentTime()
    );
    return drips;
  }

  /// @notice returns the current time.  Allows for override in testing.
  /// @return The current time (block.timestamp)
  function _currentTime() internal virtual view returns (uint256) {
    return block.timestamp;
  }

  modifier onlyComptroller() {
    require(msg.sender == comptroller, "BalanceDripManager/only-comptroller");
    _;
  }

}
