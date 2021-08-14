// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/SafeCastUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/introspection/ERC165CheckerUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "../token/ControlledToken.sol";
import "../token/ControlledTokenInterface.sol";
import "../token/TokenControllerInterface.sol";
import "../token/TokenListenerInterface.sol";
import "../token/TokenListenerLibrary.sol";

/// @title Escrows assets and deposits them into a yield source.  Exposes interest to Prize Strategy.  Users deposit and withdraw from this contract to participate in Prize Pool.
/// @notice Accounting is managed using Controlled Tokens, whose mint and burn functions can only be called by this contract.
/// @dev Must be inherited to provide specific yield-bearing asset control, such as Compound cTokens
abstract contract PrizePool is OwnableUpgradeable, ReentrancyGuardUpgradeable, TokenControllerInterface, IERC721ReceiverUpgradeable {
  using SafeMathUpgradeable for uint256;
  using SafeCastUpgradeable for uint256;
  using SafeERC20Upgradeable for IERC20Upgradeable;
  using SafeERC20Upgradeable for IERC721Upgradeable;
  // using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;
  using ERC165CheckerUpgradeable for address;

  /// @dev Emitted when an instance is initialized
  event Initialized(
    uint256 maxExitFeeMantissa
  );

  event PrizeStrategySet(
    address indexed prizeStrategy
  );

  /// @dev Event emitted when external ERC721s are awarded to a winner
  event AwardedExternalERC721(
    address indexed winner,
    address indexed token,
    uint256[] tokenIds
  );

  /// @dev Event emitted when assets are withdrawn instantly
  event InstantWithdrawal(
    address indexed operator,
    address indexed from,
    address indexed token,
    uint256 amount
  );

  event ErrorAwardingExternalERC721(bytes error);

  /// @dev Event emitted when controlled token is added
  event ControlledTokenAdded(
    ControlledTokenInterface indexed token
  );

  /// @dev Event emitted when the Liquidity Cap is set
  event LiquidityCapSet(
    uint256 liquidityCap
  );

  event Deposited(
    address indexed operator,
    address indexed to,
    address indexed token,
    uint256 amount,
    address referrer
  );


  ControlledTokenInterface[] internal _tokens;

  TokenListenerInterface public prizeStrategy;

  uint256 public maxExitFeeMantissa;

  uint256 public liquidityCap;

  function initialize (
    ControlledTokenInterface[] memory _controlledTokens,
    uint256 _maxExitFeeMantissa
  )
    public
    initializer
  {
    uint256 controlledTokensLength = _controlledTokens.length;
    _tokens = new ControlledTokenInterface[](controlledTokensLength);

    for (uint256 i = 0; i < controlledTokensLength; i++) {
      ControlledTokenInterface controlledToken = _controlledTokens[i];
      _addControlledToken(controlledToken, i);
    }
    __Ownable_init();
    __ReentrancyGuard_init();
    _setLiquidityCap(uint256(-1));

    maxExitFeeMantissa = _maxExitFeeMantissa;

    emit Initialized(maxExitFeeMantissa);
  }

  function depositTo(
    address to,
    uint256 amount,
    address controlledToken,
    address referrer
  )
    external
    // override // todo: fix
    nonReentrant
    onlyControlledToken(controlledToken)
    canAddLiquidity(amount)
  {
    address operator = _msgSender();

    _mint(to, amount, controlledToken, referrer);

    _token().safeTransferFrom(operator, address(this), amount);

    emit Deposited(operator, to, controlledToken, amount, referrer);
  }

  function withdrawInstantlyFrom(
    address from,
    uint256 amount,
    address controlledToken,
    uint256 maximumExitFee
  )
    external
    // override
    nonReentrant
    onlyControlledToken(controlledToken)
  {
    address operator = _msgSender();

    // burn the tickets
    ControlledToken(controlledToken).controllerBurnFrom(operator, from, amount);

    _token().safeTransfer(from, amount);

    emit InstantWithdrawal(operator, from, controlledToken, amount);
  }

  function beforeTokenTransfer(address from, address to, uint256 amount)
    external
    override
    onlyControlledToken(msg.sender) {
    // todo: fix
  }

  function award(
    address to,
    address externalToken,
    uint256[] calldata tokenIds
  )
    external
    // override
    onlyPrizeStrategy
  {
    require(_canAwardExternal(externalToken), "BanklessPrizePool/invalid-external-token");

    if (tokenIds.length == 0) {
      return;
    }

    for (uint256 i = 0; i < tokenIds.length; i++) {
      try IERC721Upgradeable(externalToken).safeTransferFrom(address(this), to, tokenIds[i]){

      }
      catch(bytes memory error){
        emit ErrorAwardingExternalERC721(error);
      }

    }

    emit AwardedExternalERC721(to, externalToken, tokenIds);
  }


  function _mint(address to, uint256 amount, address controlledToken, address referrer) internal {
    if (address(prizeStrategy) != address(0)) {
      prizeStrategy.beforeTokenMint(to, amount, controlledToken, referrer);
    }
    ControlledToken(controlledToken).controllerMint(to, amount);
  }

  function _canAddLiquidity(uint256 _amount) internal view returns (bool) {
    uint256 tokenTotalSupply = _tokenTotalSupply();
    return (tokenTotalSupply.add(_amount) <= liquidityCap);
  }

  /// @dev Checks if a specific token is controlled by the Prize Pool
  /// @param controlledToken The address of the token to check
  /// @return True if the token is a controlled token, false otherwise
  function _isControlled(ControlledTokenInterface controlledToken) internal view returns (bool) {
    ControlledTokenInterface[] memory tokens = _tokens; // SLOAD
    uint256 tokensLength = tokens.length;

    for(uint256 i = 0; i < tokensLength; i++) {
      if(tokens[i] == controlledToken) return true;
    }
    return false;
  }

  function _tokenTotalSupply() internal view returns (uint256) {
    // uint256 total = reserveTotalSupply;
    uint256 total = 0;
    ControlledTokenInterface[] memory tokens = _tokens; // SLOAD
    uint256 tokensLength = tokens.length;

    for(uint256 i = 0; i < tokensLength; i++){
      total = total.add(IERC20Upgradeable(tokens[i]).totalSupply());
    }

    return total;
  }

  // todo: fix
  function _token() internal virtual view returns (IERC20Upgradeable);

  // todo: fix
  function _canAwardExternal(address _externalToken) internal virtual view returns (bool);

  /// @notice Adds a new controlled token
  /// @param _controlledToken The controlled token to add.
  /// @param index The index to add the controlledToken
  function _addControlledToken(ControlledTokenInterface _controlledToken, uint256 index) internal {
    require(_controlledToken.controller() == this, "PrizePool/token-ctrlr-mismatch");

    _tokens[index] = _controlledToken;
    emit ControlledTokenAdded(_controlledToken);
  }

  /// @notice Sets the prize strategy of the prize pool.  Only callable by the owner.
  /// @param _prizeStrategy The new prize strategy
  function setPrizeStrategy(TokenListenerInterface _prizeStrategy) external
    // override
    onlyOwner {
    _setPrizeStrategy(_prizeStrategy);
  }

  /// @notice Sets the prize strategy of the prize pool.  Only callable by the owner.
  /// @param _prizeStrategy The new prize strategy
  function _setPrizeStrategy(TokenListenerInterface _prizeStrategy) internal {
    require(address(_prizeStrategy) != address(0), "PrizePool/prizeStrategy-not-zero");
    require(address(_prizeStrategy).supportsInterface(TokenListenerLibrary.ERC165_INTERFACE_ID_TOKEN_LISTENER), "PrizePool/prizeStrategy-invalid");
    prizeStrategy = _prizeStrategy;

    emit PrizeStrategySet(address(_prizeStrategy));
  }

  function tokens() external
    // override
    view returns (ControlledTokenInterface[] memory) {
    return _tokens;
  }

  /// @param data Additional data with no specified format, sent in call to `_to`.
  function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external override returns (bytes4){
    return IERC721ReceiverUpgradeable.onERC721Received.selector;
  }

  function setLiquidityCap(uint256 _liquidityCap) external
  // override 
  onlyOwner {
    _setLiquidityCap(_liquidityCap);
  }

  function _setLiquidityCap(uint256 _liquidityCap) internal {
    liquidityCap = _liquidityCap;
    emit LiquidityCapSet(_liquidityCap);
  }

  modifier canAddLiquidity(uint256 _amount) {
    require(_canAddLiquidity(_amount), "PrizePool/exceeds-liquidity-cap");
    _;
  }

  modifier onlyPrizeStrategy() {
    require(_msgSender() == address(prizeStrategy), "PrizePool/only-prizeStrategy");
    _;
  }

  modifier onlyControlledToken(address controlledToken) {
    require(_isControlled(ControlledTokenInterface(controlledToken)), "PrizePool/unknown-token");
    _;
  }
}
