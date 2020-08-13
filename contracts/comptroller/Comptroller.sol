pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";

import "../utils/UInt256Array.sol";
import "./ComptrollerStorage.sol";
import "./ComptrollerInterface.sol";

contract Comptroller is ComptrollerStorage, ComptrollerInterface {
  using SafeMath for uint256;
  using SafeCast for uint256;
  using UInt256Array for uint256[];
  using ExtendedSafeCast for uint256;
  using BalanceDripManager for BalanceDripManager.State;
  using BalanceDrip for BalanceDrip.State;
  using VolumeDrip for VolumeDrip.State;

  event ReserveRateMantissaSet(
    uint256 reserveRateMantissa
  );

  event BalanceDripAdded(
    address indexed prizeStrategy,
    address indexed measure,
    address indexed dripToken,
    uint256 dripRatePerSecond
  );

  event BalanceDripRemoved(
    address indexed prizeStrategy,
    address indexed measure,
    address indexed dripToken
  );

  event BalanceDripRateSet(
    address indexed prizeStrategy,
    address indexed measure,
    address indexed dripToken,
    uint256 dripRatePerSecond
  );

  event BalanceDripClaimed(
    address indexed prizeStrategy,
    address indexed measure,
    address indexed dripToken,
    address user,
    uint256 amount
  );

  event VolumeDripCreated(
    uint256 indexed index,
    address indexed dripToken,
    uint256 periodSeconds,
    uint256 dripAmount
  );

  event VolumeDripActivated(
    uint256 indexed index,
    address indexed prizeStrategy,
    address indexed measure,
    bool isReferral,
    uint256 activeIndex
  );

  event VolumeDripPeriodEnded(
    uint256 indexed index,
    uint16 indexed period,
    uint256 endTime
  );

  event VolumeDripPeriodStarted(
    uint256 indexed index,
    uint16 indexed period,
    uint256 startTime
  );

  event VolumeDripDeposited(
    uint256 indexed index,
    address indexed user,
    uint256 amount,
    uint256 balance,
    uint256 accrued
  );

  event VolumeDripAmountSet(
    uint256 indexed index,
    uint256 dripAmount
  );

  event VolumeDripClaimed(
    uint256 indexed index,
    address user,
    address dripToken,
    uint256 amount
  );

  event VolumeDripDeactivated(
    uint256 indexed index,
    address indexed prizeStrategy,
    address indexed measure,
    bool isReferral,
    uint256 activeIndex
  );

  function initialize(address owner) public initializer {
    __Ownable_init();
    transferOwnership(owner);
  }

  function reserveRateMantissa() external view override returns (uint256) {
    return _reserveRateMantissa;
  }

  function setReserveRateMantissa(uint256 __reserveRateMantissa) external onlyOwner returns (uint256) {
    _reserveRateMantissa = __reserveRateMantissa;

    emit ReserveRateMantissaSet(_reserveRateMantissa);
  }

  function addBalanceDrip(address prizeStrategy, address measure, address dripToken, uint256 dripRatePerSecond) external onlyOwner {
    balanceDrips[prizeStrategy].addDrip(measure, dripToken, dripRatePerSecond, _currentTime());

    emit BalanceDripAdded(
      prizeStrategy,
      measure,
      dripToken,
      dripRatePerSecond
    );
  }

  function removeBalanceDrip(address prizeStrategy, address measure, address prevDripToken, address dripToken) external onlyOwner {
    balanceDrips[prizeStrategy].removeDrip(measure, prevDripToken, dripToken);

    emit BalanceDripRemoved(prizeStrategy, measure, dripToken);
  }

  function getBalanceDrip(
    address prizeStrategy,
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
    BalanceDrip.State storage balanceDrip = balanceDrips[prizeStrategy].getDrip(measure, dripToken);
    dripRatePerSecond = balanceDrip.dripRatePerSecond;
    exchangeRateMantissa = balanceDrip.exchangeRateMantissa;
    timestamp = balanceDrip.timestamp;
  }

  function setBalanceDripRate(address prizeStrategy, address measure, address dripToken, uint256 dripRatePerSecond) external onlyOwner {
    balanceDrips[prizeStrategy].setDripRate(measure, dripToken, dripRatePerSecond);

    emit BalanceDripRateSet(
      prizeStrategy,
      measure,
      dripToken,
      dripRatePerSecond
    );
  }

  function balanceOfBalanceDrip(
    address prizeStrategy,
    address measure,
    address dripToken,
    address user
  )
    external
    returns (uint256)
  {
    balanceDrips[prizeStrategy].updateDrips(
      measure,
      user,
      IERC20(measure).balanceOf(user), // we want the original balance
      IERC20(measure).totalSupply(),
      _currentTime()
    );
    return balanceDrips[prizeStrategy].balanceDrips[measure][dripToken].userStates[user].dripBalance;
  }

  function claimBalanceDrip(address prizeStrategy, address user, address measure, address dripToken) external {
    balanceDrips[prizeStrategy].updateDrips(
      measure,
      user,
      IERC20(measure).balanceOf(user), // we want the original balance
      IERC20(measure).totalSupply(),
      _currentTime()
    );
    uint256 amount = balanceDrips[prizeStrategy].claimDripTokens(user, measure, dripToken);

    emit BalanceDripClaimed(
      prizeStrategy,
      user,
      measure,
      dripToken,
      amount
    );
  }















  function addVolumeDrip(
    address prizeStrategy,
    address measure,
    address dripToken,
    uint32 periodSeconds,
    uint128 dripAmount,
    uint32 startTime,
    bool isReferral
  )
    external
    onlyOwner
    returns (uint256 index)
  {
    PrizeStrategyVolumeDripManager storage prizeStrategyVolumeDripManager = prizeStrategyVolumeDripManagers[prizeStrategy];

    index = ++lastVolumeDripId;
    VolumeDrip.State storage drip = volumeDrips[index];
    drip.initialize(periodSeconds, dripAmount, startTime);
    volumeDripTokens[index] = dripToken;

    uint256 activeIndex;
    if (isReferral) {
      activeIndex = prizeStrategyVolumeDripManager.activeMeasureReferralVolumeDripIndices[measure].length;
      prizeStrategyVolumeDripManager.activeMeasureReferralVolumeDripIndices[measure].push(index);
    } else {
      activeIndex = prizeStrategyVolumeDripManager.activeMeasureVolumeDripIndices[measure].length;
      prizeStrategyVolumeDripManager.activeMeasureVolumeDripIndices[measure].push(index);
    }

    emit VolumeDripCreated(
      index,
      dripToken,
      periodSeconds,
      dripAmount
    );

    emit VolumeDripActivated(
      index,
      prizeStrategy,
      measure,
      isReferral,
      activeIndex
    );

    emit VolumeDripPeriodStarted(
      index,
      drip.currentPeriodIndex,
      startTime
    );
  }

  function deactivateVolumeDrip(
    address prizeStrategy,
    address measure,
    bool isReferral,
    uint256 index,
    uint256 activeIndex
  )
    public
  {
    PrizeStrategyVolumeDripManager storage prizeStrategyVolumeDripManager = prizeStrategyVolumeDripManagers[prizeStrategy];
    require(prizeStrategyVolumeDripManager.activeMeasureVolumeDripIndices[measure][activeIndex] == index, "Comptroller/volume-drip-not-active");
    prizeStrategyVolumeDripManager.activeMeasureVolumeDripIndices[measure].remove(activeIndex);
    emit VolumeDripDeactivated(
      index,
      prizeStrategy,
      measure,
      isReferral,
      activeIndex
    );
  }

  function findActiveMeasureVolumeDripIndex(
    PrizeStrategyVolumeDripManager storage prizeStrategyVolumeDripManager,
    address measure,
    uint256 index
  )
    internal
    view
    returns (
      uint256 activeMeasureVolumeDripIndex,
      bool found
    )
  {
    // This for loop may blow up, so have a backup!
    for (uint256 i = 0; i < prizeStrategyVolumeDripManager.activeMeasureVolumeDripIndices[measure].length; i++) {
      if (prizeStrategyVolumeDripManager.activeMeasureVolumeDripIndices[measure][i] == index) {
        activeMeasureVolumeDripIndex = i;
        found = true;
        break;
      }
    }
  }

  function getVolumeDrip(
    uint256 index
  )
    external
    view
    returns (
      uint32 periodSeconds,
      uint128 dripAmount,
      uint32 startTime
    )
  {
    periodSeconds = volumeDrips[index].periodSeconds;
    dripAmount = volumeDrips[index].dripAmount;
    startTime = volumeDrips[index].currentPeriod().startTime;
  }

  function setVolumeDripAmount(uint256 index, uint128 dripAmount) external onlyOwner {
    require(index <= lastVolumeDripId, "Comptroller/volume-drip-invalid");
    volumeDrips[index].dripAmount = dripAmount;

    emit VolumeDripAmountSet(
      index,
      dripAmount
    );
  }

  function depositVolumeDrip(
    address user,
    uint256 amount,
    uint256[] storage volumeDripIndices
  )
    internal
  {
    for (uint256 i = 0; i < volumeDripIndices.length; i++) {
      VolumeDrip.State storage dripState = volumeDrips[volumeDripIndices[i]];
      checkVolumeDripPeriod(volumeDripIndices[i]);
      dripState.mint(
        user,
        amount,
        _currentTime()
      );

      emit VolumeDripDeposited(
        volumeDripIndices[i],
        user,
        amount,
        dripState.deposits[user].balance,
        dripState.deposits[user].accrued
      );
    }
  }

  function checkVolumeDripPeriod(uint256 index) internal {
    if (volumeDrips[index].isPeriodOver(_currentTime())) {
      uint256 endTime = volumeDrips[index].currentPeriodEndAt();
      uint16 lastPeriod = volumeDrips[index].currentPeriodIndex;

      volumeDrips[index].completePeriod(_currentTime());

      emit VolumeDripPeriodEnded(
        index,
        lastPeriod,
        endTime
      );

      emit VolumeDripPeriodStarted(
        index,
        volumeDrips[index].currentPeriodIndex,
        volumeDrips[index].currentPeriod().startTime
      );
    }
  }

  function balanceOfVolumeDrip(uint256 index, address user) external returns (uint256) {
    checkVolumeDripPeriod(index);
    return volumeDrips[index].balanceOf(user).accrued;
  }

  function claimVolumeDrip(uint256 index, address user) external {
    VolumeDrip.State storage volumeDrip = volumeDrips[index];
    checkVolumeDripPeriod(index);
    uint256 amount = volumeDrip.burnDrip(user);
    address token = volumeDripTokens[index];

    require(IERC20(token).transfer(user, amount), "Comptroller/volume-drip-transfer-failed");

    emit VolumeDripClaimed(
      index,
      user,
      token,
      amount
    );
  }


  // function removeDrip(
  //   address measure,
  //   uint256 index,
  //   uint256 activeMeasureVolumeDripIndex
  // )
  //   internal
  // {
  //   require(self.activeMeasureVolumeDripIndices[measure][activeMeasureVolumeDripIndex] == index, "VolumeDripManager/index-mismatch");
  //   self.activeMeasureVolumeDripIndices[measure].remove(activeMeasureVolumeDripIndex);
  //   delete self.volumeDripTokens[index];
  //   delete self.volumeDrips[index].periodSeconds;
  //   delete self.volumeDrips[index].dripAmount;
  //   delete self.volumeDrips[index];
  // }


























  function updateBalanceDrips(
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
      dripState.drip(
        user,
        measureBalance,
        measureTotalSupply,
        currentTime
      );
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
    updateBalanceDrips(
      balanceDrips[msg.sender],
      controlledToken,
      to,
      balance.sub(amount), // we want the previous balance
      totalSupply.sub(amount), // previous totalSupply
      _currentTime()
    );

    PrizeStrategyVolumeDripManager storage prizeStrategyVolumeDripManager = prizeStrategyVolumeDripManagers[msg.sender];

    depositVolumeDrip(
      to,
      amount,
      prizeStrategyVolumeDripManager.activeMeasureVolumeDripIndices[controlledToken]
    );

    if (referrer != address(0)) {
      depositVolumeDrip(
        referrer,
        amount,
        prizeStrategyVolumeDripManager.activeMeasureReferralVolumeDripIndices[controlledToken]
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
    balanceDrips[msg.sender].updateDrips(
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
