pragma solidity ^0.6.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";

import "../utils/UInt256Array.sol";
import "./ComptrollerStorage.sol";
import "./ComptrollerInterface.sol";

contract Comptroller is ComptrollerStorage, ComptrollerInterface {
  using SafeMath for uint256;
  using SafeCast for uint256;
  using UInt256Array for uint256[];
  using ExtendedSafeCast for uint256;
  using BalanceDrip for BalanceDrip.State;
  using VolumeDrip for VolumeDrip.State;
  using BalanceDripManager for BalanceDripManager.State;
  using VolumeDripManager for VolumeDripManager.State;

  event ReserveRateMantissaSet(
    uint256 reserveRateMantissa
  );

  event BalanceDripActivated(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    uint256 dripRatePerSecond
  );

  event BalanceDripDeactivated(
    address indexed source,
    address indexed measure,
    address indexed dripToken
  );

  event BalanceDripRateSet(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    uint256 dripRatePerSecond
  );

  event DripTokenClaimed(
    address indexed source,
    address indexed dripToken,
    address user,
    uint256 amount
  );

  event VolumeDripActivated(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    bool isReferral,
    uint256 periodSeconds,
    uint256 dripAmount
  );

  event VolumeDripPeriodStarted(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    bool isReferral,
    uint256 dripAmount,
    uint256 endTime
  );

  event VolumeDripPeriodEnded(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    bool isReferral,
    uint256 totalSupply
  );

  event VolumeDripDeposited(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    bool isReferral,
    address user,
    uint256 amount,
    uint256 balance,
    uint256 accrued
  );

  event VolumeDripSet(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    bool isReferral,
    uint256 periodSeconds,
    uint256 dripAmount
  );

  event VolumeDripDeactivated(
    address indexed source,
    address indexed measure,
    address indexed dripToken,
    bool isReferral
  );

  struct UpdatePair {
    address source;
    address measure;
  }

  struct DripTokenBalance {
    address dripToken;
    uint256 balance;
  }

  function initialize(address _owner) public initializer {
    __Ownable_init();
    transferOwnership(_owner);
  }

  function reserveRateMantissa() external view override returns (uint256) {
    return _reserveRateMantissa;
  }

  function setReserveRateMantissa(uint256 __reserveRateMantissa) external onlyOwner returns (uint256) {
    _reserveRateMantissa = __reserveRateMantissa;

    emit ReserveRateMantissaSet(_reserveRateMantissa);
  }

  function activateBalanceDrip(address source, address measure, address dripToken, uint256 dripRatePerSecond) external onlyOwner {
    balanceDrips[source].activateDrip(measure, dripToken, dripRatePerSecond, _currentTime().toUint32());

    emit BalanceDripActivated(
      source,
      measure,
      dripToken,
      dripRatePerSecond
    );
  }

  function deactivateBalanceDrip(address source, address measure, address dripToken, address prevDripToken) external onlyOwner {
    balanceDrips[source].deactivateDrip(measure, dripToken, prevDripToken, _currentTime().toUint32());

    emit BalanceDripDeactivated(source, measure, dripToken);
  }

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

  function setBalanceDripRate(address source, address measure, address dripToken, uint256 dripRatePerSecond) external onlyOwner {
    balanceDrips[source].setDripRate(measure, dripToken, dripRatePerSecond, _currentTime().toUint32());

    emit BalanceDripRateSet(
      source,
      measure,
      dripToken,
      dripRatePerSecond
    );
  }













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
    if (isReferral) {
      referralVolumeDrips[source].activate(measure, dripToken, periodSeconds, dripAmount, endTime);
    } else {
      volumeDrips[source].activate(measure, dripToken, periodSeconds, dripAmount, endTime);
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
      dripAmount,
      endTime
    );
  }

  function deactivateVolumeDrip(
    address source,
    address measure,
    address dripToken,
    bool isReferral,
    address prevDripToken
  )
    public
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

  function depositVolumeDrip(
    VolumeDripManager.State storage manager,
    bool isReferral,
    address measure,
    address user,
    uint256 amount
  )
    internal
  {
    uint256 currentTime = _currentTime();
    address currentDripToken = manager.activeVolumeDrips[measure].addressMap[MappedSinglyLinkedList.SENTINAL];
    while (currentDripToken != address(0) && currentDripToken != MappedSinglyLinkedList.SENTINAL) {
      VolumeDrip.State storage dripState = manager.volumeDrips[measure][currentDripToken];
      (uint256 newTokens, bool isNewPeriod) = dripState.mint(
        user,
        amount,
        currentTime
      );
      if (newTokens > 0) {
        dripTokenBalances[currentDripToken][user] = dripTokenBalances[currentDripToken][user].add(newTokens);
      }
      currentDripToken = manager.activeVolumeDrips[measure].addressMap[currentDripToken];

      if (isNewPeriod) {
        uint16 lastPeriod = uint256(dripState.periodCount).sub(1).toUint16();
        emit VolumeDripPeriodEnded(
          _msgSender(),
          measure,
          currentDripToken,
          isReferral,
          dripState.periods[lastPeriod].totalSupply
        );
        emit VolumeDripPeriodStarted(
          _msgSender(),
          measure,
          currentDripToken,
          isReferral,
          dripState.periods[dripState.periodCount].dripAmount,
          dripState.periods[dripState.periodCount].endTime
        );
      }
    }
  }


  function balanceOfDrip(address dripToken, address user) external view returns (uint256) {
    return dripTokenBalances[dripToken][user];
  }

  function claimDrip(address user, address dripToken, uint256 amount) external {
    address sender = _msgSender();
    dripTokenBalances[dripToken][user] = dripTokenBalances[dripToken][user].sub(amount);
    require(IERC20(dripToken).transfer(user, amount), "Comptroller/claim-transfer-failed");

    emit DripTokenClaimed(sender, user, dripToken, amount);
  }

















  function updateDrips(
    UpdatePair[] calldata pairs,
    address user,
    address[] calldata dripTokens
  )
    external
    returns (DripTokenBalance[] memory)
  {
    uint256 i;
    for (i = 0; i < pairs.length; i++) {
      UpdatePair memory pair = pairs[i];
      _updateBalanceDrips(
        balanceDrips[pair.source],
        pair.measure,
        user,
        IERC20(pair.measure).balanceOf(user),
        IERC20(pair.measure).totalSupply(),
        _currentTime()
      );

      depositVolumeDrip(
        volumeDrips[pair.source],
        false,
        pair.measure,
        user,
        0
      );

      depositVolumeDrip(
        referralVolumeDrips[pair.source],
        true,
        pair.measure,
        user,
        0
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

  function _updateBalanceDrips(
    BalanceDripManager.State storage self,
    address measure,
    address user,
    uint256 measureBalance,
    uint256 measureTotalSupply,
    uint256 currentTime
  ) internal {
    address currentDripToken = self.activeBalanceDrips[measure].addressMap[MappedSinglyLinkedList.SENTINAL];
    while (currentDripToken != address(0) && currentDripToken != MappedSinglyLinkedList.SENTINAL) {
      BalanceDrip.State storage dripState = self.balanceDrips[measure][currentDripToken];
      uint128 newTokens = dripState.drip(
        user,
        measureBalance,
        measureTotalSupply,
        currentTime
      );
      if (newTokens > 0) {
        dripTokenBalances[currentDripToken][user] = dripTokenBalances[currentDripToken][user].add(newTokens);
      }
      currentDripToken = self.activeBalanceDrips[measure].addressMap[currentDripToken];
    }
  }

  function afterDepositTo(
    address to,
    uint256 amount,
    uint256 balance,
    uint256 totalSupply,
    address controlledToken,
    address referrer
  )
    external
    override
  {
    _updateBalanceDrips(
      balanceDrips[_msgSender()],
      controlledToken,
      to,
      balance.sub(amount), // we want the previous balance
      totalSupply.sub(amount), // previous totalSupply
      _currentTime()
    );

    depositVolumeDrip(
      volumeDrips[_msgSender()],
      false,
      controlledToken,
      to,
      amount
    );

    if (referrer != address(0)) {
      depositVolumeDrip(
        referralVolumeDrips[_msgSender()],
        true,
        controlledToken,
        referrer,
        amount
      );
    }
  }

  function afterWithdrawFrom(
    address from,
    uint256 amount,
    uint256 balance,
    uint256 totalSupply,
    address controlledToken
  )
    external
    override
  {
    _updateBalanceDrips(
      balanceDrips[msg.sender],
      controlledToken,
      from,
      balance.add(amount), // we want the original balance
      totalSupply.add(amount),
      _currentTime()
    );
  }

  /// @notice returns the current time.  Used for testing.
  /// @return The current time (block.timestamp)
  function _currentTime() internal virtual view returns (uint256) {
    return block.number;
  }

}
