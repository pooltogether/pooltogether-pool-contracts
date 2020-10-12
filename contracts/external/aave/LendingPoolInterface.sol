pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

interface LendingPoolInterface is IERC20 {
  function addressesProvider() external view returns (address);
  function deposit(address _reserve, uint256 _amount, uint16 _referralCode) external payable;
  function redeemUnderlying (address _reserve, address _user, uint256 _amount) external;
  function setUserUseReserveAsCollateral(address _reserve, bool _useAsCollateral) external;
  function borrow(address _reserve, uint256 _amount, uint256 _interestRateMode, uint16 _referralCode) external;
  function repay( address _reserve, uint256 _amount, address payable _onBehalfOf) external payable;
  function swapBorrowRateMode(address _reserve) external;
  function rebalanceStableBorrowRate(address _reserve, address _user) external;
  function liquidationCall(address _collateral, address _reserve, address _user, uint256 _purchaseAmount, bool _receiveaToken) external payable;
  function flashLoan(address payable _receiver, address _reserve, uint _amount, bytes calldata _params) external;

  function getReserveConfigurationData(address _reserve) external view returns
    (
      uint256 ltv,
      uint256 liquidationThreshold,
      uint256 liquidationBonus,
      address interestRateStrategyAddress,
      bool usageAsCollateralEnabled,
      bool borrowingEnabled,
      bool stableBorrowRateEnabled,
      bool isActive
    );

  function getReserveData(address _reserve) external view returns
    (
      uint256 totalLiquidity,
      uint256 availableLiquidity,
      uint256 totalBorrowsStable,
      uint256 totalBorrowsVariable,
      uint256 liquidityRate,
      uint256 variableBorrowRate,
      uint256 stableBorrowRate,
      uint256 averageStableBorrowRate,
      uint256 utilizationRate,
      uint256 liquidityIndex,
      uint256 variableBorrowIndex,
      address aTokenAddress,
      uint40 lastUpdateTimestamp
    );

  function getUserAccountData(address _user) external view returns
    (
      uint256 totalLiquidityETH,
      uint256 totalCollateralETH,
      uint256 totalBorrowsETH,
      uint256 totalFeesETH,
      uint256 availableBorrowsETH,
      uint256 currentLiquidationThreshold,
      uint256 ltv,
      uint256 healthFactor
    );

  function getUserReserveData(address _reserve, address _user) external view returns
    (
      uint256 currentATokenBalance,
      uint256 currentBorrowBalance,
      uint256 principalBorrowBalance,
      uint256 borrowRateMode,
      uint256 borrowRate,
      uint256 liquidityRate,
      uint256 originationFee,
      uint256 variableBorrowIndex,
      uint256 lastUpdateTimestamp,
      bool usageAsCollateralEnabled
    );

  function getReserves() external view;
}
