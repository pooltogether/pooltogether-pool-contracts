// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

import "../../external/pooltogether/FixedPoint.sol";
import "../../external/aave/ATokenInterface.sol";
import "../../external/aave/LendingPoolAddressesProviderInterface.sol";
import "../../external/aave/LendingPoolInterface.sol";
import "../PrizePool.sol";

/// @title Prize Pool with Aave's aToken
/// @notice Manages depositing and withdrawing assets from the Prize Pool
contract AavePrizePool is PrizePool {
  using SafeMath for uint256;

  event AavePrizePoolInitialized(address indexed aToken, address indexed lendingPoolAddressesProviderAddress);

  /// @notice Aave aToken interface
  ATokenInterface public aToken;

  /// @notice Aave lendingPoolAddressesProviderAddress
  address public lendingPoolAddressesProviderAddress;

  /// @notice Initializes the Prize Pool and Yield Service with the required contract connections
  /// @param _trustedForwarder Address of the Forwarding Contract for GSN Meta-Txs
  /// @param _controlledTokens Array of addresses for the Ticket and Sponsorship Tokens controlled by the Prize Pool
  /// @param _maxExitFeeMantissa The maximum exit fee size, relative to the withdrawal amount
  /// @param _maxTimelockDuration The maximum length of time the withdraw timelock could be
  /// @param _aToken Address of the Aave aToken interface
  function initialize (
    address _trustedForwarder,
    RegistryInterface _reserveRegistry,
    address[] memory _controlledTokens,
    uint256 _maxExitFeeMantissa,
    uint256 _maxTimelockDuration,
    ATokenInterface _aToken,
    address _lendingPoolAddressesProviderAddress
  )
    public
    initializer
  {
    PrizePool.initialize(
      _trustedForwarder,
      _reserveRegistry,
      _controlledTokens,
      _maxExitFeeMantissa,
      _maxTimelockDuration
    );
    aToken = _aToken;
    lendingPoolAddressesProviderAddress = _lendingPoolAddressesProviderAddress;

    emit AavePrizePoolInitialized(address(aToken), address(lendingPoolAddressesProviderAddress));
  }

  /// @dev Returns the total balance (in asset tokens).  This includes the deposits and interest.
  /// @return The underlying balance of asset tokens
  function _balance() internal override returns (uint256) {
    return aToken.balanceOf(address(this));
  }

  /// @dev Allows a user to supply asset tokens in exchange for yield-bearing tokens
  /// to be held in escrow by the Yield Service
  /// @param amount The amount of asset tokens to be supplied
  function _supply(uint256 amount) internal override {
    _token().approve(_provider().getLendingPoolCore(), amount);
    _lendingPool().deposit(address(_tokenAddress()), amount, uint16(138));
  }

  /// @dev The external token cannot be aToken
  /// @param _externalToken The address of the token to check
  /// @return True if the token may be awarded, false otherwise
  function _canAwardExternal(address _externalToken) internal override view returns (bool) {
    return _externalToken != address(aToken);
  }

  /// @dev Allows a user to redeem yield-bearing tokens in exchange for the underlying
  /// asset tokens held in escrow by the Yield Service
  /// @param amount The amount of underlying tokens to be redeemed
  /// @return The actual amount of tokens transferred
  function _redeem(uint256 amount) internal override returns (uint256) {
    aToken.redeem(amount);
    return amount;
  }

  /// @dev Gets the underlying asset token used by the Yield Service
  /// @return A reference to the interface of the underling asset token
  function _token() internal override view returns (IERC20) {
    return IERC20(_tokenAddress());
  }

  /// @dev Gets the underlying asset token address
  /// @return Underlying asset token address
  function _tokenAddress() internal view returns (address) {
    return aToken.underlyingAssetAddress();
  }

  /// @dev Retrieve LendingPoolAddressesProvider address
  /// @return A reference to LendingPoolAddressesProvider interface
  function _provider() internal view returns (LendingPoolAddressesProviderInterface) {
    return LendingPoolAddressesProviderInterface(address(lendingPoolAddressesProviderAddress));
  }

  /// @dev Retrieve LendingPool address
  /// @return A reference to LendingPool interface
  function _lendingPool() internal view returns (LendingPoolInterface) {
    return LendingPoolInterface(_provider().getLendingPool());
  }
}
