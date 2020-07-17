pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";

import "./ComptrollerStorage.sol";
import "./ComptrollerInterface.sol";

contract Comptroller is ComptrollerStorage, ComptrollerInterface {
  using SafeMath for uint256;
  using SafeCast for uint256;
  using BalanceDripManager for BalanceDripManager.State;
  using VolumeDripManager for VolumeDripManager.State;
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

  event VolumeDripAdded(
    address indexed prizeStrategy,
    address indexed measure,
    address indexed dripToken,
    uint256 index,
    uint256 periodBlocks,
    uint256 dripRatePerSecond
  );

  event VolumeDripRemoved(
    address indexed prizeStrategy,
    address indexed measure,
    uint256 indexed index
  );

  event VolumeDripAmountSet(
    address prizeStrategy,
    uint256 index,
    uint256 dripAmount
  );

  event ReferralVolumeDripAdded(
    address indexed prizeStrategy,
    address indexed measure,
    address indexed dripToken,
    uint256 index,
    uint256 periodBlocks,
    uint256 dripRatePerSecond
  );

  event ReferralVolumeDripRemoved(
    address indexed prizeStrategy,
    address indexed measure,
    uint256 indexed index
  );

  event ReferralVolumeDripAmountSet(
    address prizeStrategy,
    uint256 index,
    uint256 dripAmount
  );

  function initialize() public initializer {
    __Ownable_init();
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
    uint32 startTime
  )
    external
    onlyOwner
  {
    uint256 index = volumeDrips[prizeStrategy].addDrip(measure, dripToken, periodSeconds, dripAmount, startTime);

    emit VolumeDripAdded(
      prizeStrategy,
      measure,
      dripToken,
      index,
      periodSeconds,
      dripAmount
    );
  }

  function removeVolumeDrip(address prizeStrategy, address measure, uint256 index) external onlyOwner {
    volumeDrips[prizeStrategy].removeDrip(measure, index);

    emit VolumeDripRemoved(prizeStrategy, measure, index);
  }

  function setVolumeDripAmount(address prizeStrategy, uint256 index, uint128 dripAmount) external onlyOwner {
    volumeDrips[prizeStrategy].setDripAmount(index, dripAmount);

    emit VolumeDripAmountSet(
      prizeStrategy,
      index,
      dripAmount
    );
  }

  function balanceOfVolumeDrip(address prizeStrategy, address user, uint256 index) external returns (uint256) {
    return volumeDrips[prizeStrategy].volumeDrips[index].balanceOf(user, _currentTime()).accrued;
  }

  function claimVolumeDrip(address prizeStrategy, address user, uint256 index) external {
    (address token, uint256 amount) = volumeDrips[prizeStrategy].claimDripTokens(index, user, _currentTime().toUint32());
    require(IERC20(token).transfer(user, amount), "Comptroller/volume-drip-transfer-failed");
  }

  function addReferralVolumeDrip(
    address prizeStrategy,
    address measure,
    address dripToken,
    uint32 periodSeconds,
    uint128 dripAmount,
    uint32 startTime
  )
    external
    onlyOwner
  {
    uint256 index = referralVolumeDrips[prizeStrategy].addDrip(measure, dripToken, periodSeconds, dripAmount, startTime);

    emit ReferralVolumeDripAdded(
      prizeStrategy,
      measure,
      dripToken,
      index,
      periodSeconds,
      dripAmount
    );
  }

  function removeReferralVolumeDrip(address prizeStrategy, address measure, uint256 index) external onlyOwner {
    referralVolumeDrips[prizeStrategy].removeDrip(measure, index);

    emit ReferralVolumeDripRemoved(prizeStrategy, measure, index);
  }

  function setReferralVolumeDripAmount(address prizeStrategy, uint256 index, uint128 dripAmount) external onlyOwner {
    referralVolumeDrips[prizeStrategy].setDripAmount(index, dripAmount);

    emit ReferralVolumeDripAmountSet(
      prizeStrategy,
      index,
      dripAmount
    );
  }

  function balanceOfReferralVolumeDrip(address prizeStrategy, address user, uint256 index) external returns (uint256) {
    return referralVolumeDrips[prizeStrategy].volumeDrips[index].balanceOf(user, _currentTime()).accrued;
  }

  function claimReferralVolumeDrip(address prizeStrategy, address user, uint256 index) external {
    (address token, uint256 amount) = referralVolumeDrips[prizeStrategy].claimDripTokens(index, user, _currentTime().toUint32());
    require(IERC20(token).transfer(user, amount), "Comptroller/volume-drip-transfer-failed");
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
    balanceDrips[msg.sender].updateDrips(
      controlledToken,
      to,
      balance.sub(amount), // we want the previous balance
      totalSupply.sub(amount), // previous totalSupply
      _currentTime()
    );

    volumeDrips[msg.sender].deposit(
      controlledToken,
      to,
      amount,
      _currentTime()
    );

    if (referrer != address(0)) {
      referralVolumeDrips[msg.sender].deposit(
        controlledToken,
        referrer,
        amount,
        _currentTime()
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
