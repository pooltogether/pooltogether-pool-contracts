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
    uint256 periodSeconds,
    uint256 dripAmount
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

  event VolumeDripClaimed(
    address prizeStrategy,
    uint256 index,
    address user,
    address dripToken,
    uint256 amount
  );

  event ReferralVolumeDripAdded(
    address indexed prizeStrategy,
    address indexed measure,
    address indexed dripToken,
    uint256 index,
    uint256 periodSeconds,
    uint256 dripAmount
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

  event ReferralVolumeDripClaimed(
    address prizeStrategy,
    uint256 index,
    address user,
    address dripToken,
    uint256 amount
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

  function getVolumeDrip(
    address prizeStrategy,
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
    periodSeconds = volumeDrips[prizeStrategy].volumeDrips[index].periodSeconds;
    dripAmount = volumeDrips[prizeStrategy].volumeDrips[index].dripAmount;
    startTime = volumeDrips[prizeStrategy].volumeDrips[index].currentPeriod().startTime;
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

    emit VolumeDripClaimed(
      prizeStrategy,
      index,
      user,
      token,
      amount
    );
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

  function getReferralVolumeDrip(
    address prizeStrategy,
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
    periodSeconds = referralVolumeDrips[prizeStrategy].volumeDrips[index].periodSeconds;
    dripAmount = referralVolumeDrips[prizeStrategy].volumeDrips[index].dripAmount;
    startTime = referralVolumeDrips[prizeStrategy].volumeDrips[index].currentPeriod().startTime;
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
    require(IERC20(token).transfer(user, amount), "Comptroller/referral-drip-transfer-failed");

    emit ReferralVolumeDripClaimed(
      prizeStrategy,
      index,
      user,
      token,
      amount
    );
  }






  function beforeTokenMint(
    address to,
    uint256 amount,
    address controlledToken,
    address referrer
  )
    external
    override
  {
    address source = msg.sender;
    uint256 balance = IERC20(controlledToken).balanceOf(to);
    uint256 totalSupply = IERC20(controlledToken).totalSupply();

    balanceDrips[source].updateDrips(
      controlledToken,
      to,
      balance,
      totalSupply,
      _currentTime()
    );

    volumeDrips[source].deposit(
      controlledToken,
      to,
      amount,
      _currentTime()
    );

    if (referrer != address(0)) {
      referralVolumeDrips[source].deposit(
        controlledToken,
        referrer,
        amount,
        _currentTime()
      );
    }
  }

  function beforeTokenTransfer(
    address from,
    address to,
    uint256,
    address controlledToken
  )
    external
    override
  {
    // if we are burning
    if (to == address(0)) {
      uint256 balance = IERC20(controlledToken).balanceOf(from);
      uint256 totalSupply = IERC20(controlledToken).totalSupply();

      balanceDrips[msg.sender].updateDrips(
        controlledToken,
        from,
        balance, // we want the original balance
        totalSupply,
        _currentTime()
      );
    }
  }

  /// @notice returns the current time.  Used for testing.
  /// @return The current time (block.timestamp)
  function _currentTime() internal virtual view returns (uint256) {
    return block.number;
  }

}
