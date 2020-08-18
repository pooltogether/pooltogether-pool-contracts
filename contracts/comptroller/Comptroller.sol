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
  using BalanceDripManager for BalanceDripManager.State;
  using BalanceDrip for BalanceDrip.State;
  using VolumeDrip for VolumeDrip.State;

  event ReserveRateMantissaSet(
    uint256 reserveRateMantissa
  );

  event BalanceDripActivated(
    address indexed operator,
    address indexed measure,
    address indexed dripToken,
    uint256 dripRatePerSecond
  );

  event BalanceDripDeactivated(
    address indexed operator,
    address indexed measure,
    address indexed dripToken
  );

  event BalanceDripRateSet(
    address indexed operator,
    address indexed measure,
    address indexed dripToken,
    uint256 dripRatePerSecond
  );

  event DripTokenClaimed(
    address indexed operator,
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
    address indexed operator,
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
    address indexed operator,
    address indexed measure,
    bool isReferral,
    uint256 activeIndex
  );

  struct UpdatePair {
    address operator;
    address measure;
  }

  struct DripTokenBalance {
    address dripToken;
    uint256 balance;
  }

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

  function activateBalanceDrip(address operator, address measure, address dripToken, uint256 dripRatePerSecond) external onlyOwner {
    balanceDrips[operator].activateDrip(measure, dripToken, dripRatePerSecond, _currentTime().toUint32());

    emit BalanceDripActivated(
      operator,
      measure,
      dripToken,
      dripRatePerSecond
    );
  }

  function deactivateBalanceDrip(address operator, address measure, address dripToken, address prevDripToken) external onlyOwner {
    balanceDrips[operator].deactivateDrip(measure, dripToken, prevDripToken, _currentTime().toUint32());

    emit BalanceDripDeactivated(operator, measure, dripToken);
  }

  function getBalanceDrip(
    address operator,
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
    BalanceDrip.State storage balanceDrip = balanceDrips[operator].getDrip(measure, dripToken);
    dripRatePerSecond = balanceDrip.dripRatePerSecond;
    exchangeRateMantissa = balanceDrip.exchangeRateMantissa;
    timestamp = balanceDrip.timestamp;
  }

  function setBalanceDripRate(address operator, address measure, address dripToken, uint256 dripRatePerSecond) external onlyOwner {
    balanceDrips[operator].setDripRate(measure, dripToken, dripRatePerSecond, _currentTime().toUint32());

    emit BalanceDripRateSet(
      operator,
      measure,
      dripToken,
      dripRatePerSecond
    );
  }













/*

  function addVolumeDrip(
    address operator,
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
    PrizeStrategyVolumeDripManager storage operatorVolumeDripManager = operatorVolumeDripManagers[operator];

    index = ++lastVolumeDripId;
    VolumeDrip.State storage drip = volumeDrips[index];
    drip.initialize(periodSeconds, dripAmount, startTime);
    volumeDripTokens[index] = dripToken;

    uint256 activeIndex;
    if (isReferral) {
      activeIndex = operatorVolumeDripManager.activeMeasureReferralVolumeDripIndices[measure].length;
      operatorVolumeDripManager.activeMeasureReferralVolumeDripIndices[measure].push(index);
    } else {
      activeIndex = operatorVolumeDripManager.activeMeasureVolumeDripIndices[measure].length;
      operatorVolumeDripManager.activeMeasureVolumeDripIndices[measure].push(index);
    }

    emit VolumeDripCreated(
      index,
      dripToken,
      periodSeconds,
      dripAmount
    );

    emit VolumeDripActivated(
      index,
      operator,
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
    address operator,
    address measure,
    bool isReferral,
    uint256 index,
    uint256 activeIndex
  )
    public
  {
    PrizeStrategyVolumeDripManager storage operatorVolumeDripManager = operatorVolumeDripManagers[operator];
    require(operatorVolumeDripManager.activeMeasureVolumeDripIndices[measure][activeIndex] == index, "Comptroller/volume-drip-not-active");
    operatorVolumeDripManager.activeMeasureVolumeDripIndices[measure].remove(activeIndex);
    emit VolumeDripDeactivated(
      index,
      operator,
      measure,
      isReferral,
      activeIndex
    );
  }

  function findActiveMeasureVolumeDripIndex(
    PrizeStrategyVolumeDripManager storage operatorVolumeDripManager,
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
    for (uint256 i = 0; i < operatorVolumeDripManager.activeMeasureVolumeDripIndices[measure].length; i++) {
      if (operatorVolumeDripManager.activeMeasureVolumeDripIndices[measure][i] == index) {
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
*/

  function balanceOfDrip(address dripToken, address user) external view returns (uint256) {
    return dripTokenBalances[dripToken][user];
  }

  function claimDrip(address user, address dripToken, uint256 amount) external {
    address sender = _msgSender();
    dripTokenBalances[dripToken][user] = dripTokenBalances[dripToken][user].sub(amount);
    require(IERC20(dripToken).transfer(user, amount), "Comptroller/claim-transfer-failed");

    emit DripTokenClaimed(sender, user, dripToken, amount);
  }

















  function updateBalanceDrips(
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
      updateBalanceDrips(
        balanceDrips[pair.operator],
        pair.measure,
        user,
        IERC20(pair.measure).balanceOf(user),
        IERC20(pair.measure).totalSupply(),
        _currentTime()
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
    updateBalanceDrips(
      balanceDrips[msg.sender],
      controlledToken,
      to,
      balance.sub(amount), // we want the previous balance
      totalSupply.sub(amount), // previous totalSupply
      _currentTime()
    );

/*
    PrizeStrategyVolumeDripManager storage operatorVolumeDripManager = operatorVolumeDripManagers[msg.sender];

    depositVolumeDrip(
      to,
      amount,
      operatorVolumeDripManager.activeMeasureVolumeDripIndices[controlledToken]
    );

    if (referrer != address(0)) {
      depositVolumeDrip(
        referrer,
        amount,
        operatorVolumeDripManager.activeMeasureReferralVolumeDripIndices[controlledToken]
      );
    }
    */
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
    updateBalanceDrips(
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
