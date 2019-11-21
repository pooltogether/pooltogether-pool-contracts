/**
Copyright 2019 PoolTogether LLC

This file is part of PoolTogether.

PoolTogether is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation under version 3 of the License.

PoolTogether is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with PoolTogether.  If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity 0.5.12;

import "./BasePool.sol";
import "@openzeppelin/contracts/contracts/token/ERC777/IERC777.sol";
import "@openzeppelin/contracts/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts/contracts/token/ERC777/IERC777Sender.sol";
import "@openzeppelin/contracts/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts/contracts/utils/Address.sol";

/**
 * @dev Implementation of the {IERC777} interface.
 *
 * Largely taken from the OpenZeppelin ERC777 contract.
 *
 * Support for ERC20 is included in this contract, as specified by the EIP: both
 * the ERC777 and ERC20 interfaces can be safely used when interacting with it.
 * Both {IERC777-Sent} and {IERC20-Transfer} events are emitted on token
 * movements.
 *
 * Additionally, the {IERC777-granularity} value is hard-coded to `1`, meaning that there
 * are no special restrictions in the amount of tokens that created, moved, or
 * destroyed. This makes integration with ERC20 applications seamless.
 *
 * It is important to note that no Mint events are emitted.  Tokens are minted in batches
 * by a state change in a tree data structure, so emitting a Mint event for each user
 * is not possible.
 *
 */
contract ERC777Pool is IERC20, IERC777, BasePool {
  using SafeMath for uint256;
  using Address for address;

  IERC1820Registry constant internal ERC1820_REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);

  // We inline the result of the following hashes because Solidity doesn't resolve them at compile time.
  // See https://github.com/ethereum/solidity/issues/4024.

  // keccak256("ERC777TokensSender")
  bytes32 constant internal TOKENS_SENDER_INTERFACE_HASH =
      0x29ddb589b1fb5fc7cf394961c1adf5f8c6454761adf795e67fe149f658abe895;

  // keccak256("ERC777TokensRecipient")
  bytes32 constant internal TOKENS_RECIPIENT_INTERFACE_HASH =
      0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b;

  string internal _name;
  string internal _symbol;

  // This isn't ever read from - it's only used to respond to the defaultOperators query.
  address[] internal _defaultOperatorsArray;

  // Immutable, but accounts may revoke them (tracked in __revokedDefaultOperators).
  mapping(address => bool) internal _defaultOperators;

  // For each account, a mapping of its operators and revoked default operators.
  mapping(address => mapping(address => bool)) internal _operators;
  mapping(address => mapping(address => bool)) internal _revokedDefaultOperators;

  // ERC20-allowances
  mapping (address => mapping (address => uint256)) internal _allowances;

  function init (
    address _owner,
    address _cToken,
    uint256 _feeFraction,
    address _feeBeneficiary,
    string memory name,
    string memory symbol,
    address[] memory defaultOperators
  ) public initializer {
    init(_owner, _cToken, _feeFraction, _feeBeneficiary);
    initERC777(name, symbol, defaultOperators);
  }

  /**
    * @dev `defaultOperators` may be an empty array.
    */
  function initERC777 (
      string memory name,
      string memory symbol,
      address[] memory defaultOperators
  ) public {
      require(bytes(name).length != 0, "name must be defined");
      require(bytes(symbol).length != 0, "symbol must be defined");
      require(bytes(_name).length == 0, "ERC777 has already been initialized");

      _name = name;
      _symbol = symbol;

      _defaultOperatorsArray = defaultOperators;
      for (uint256 i = 0; i < _defaultOperatorsArray.length; i++) {
          _defaultOperators[_defaultOperatorsArray[i]] = true;
      }

      // register interfaces
      ERC1820_REGISTRY.setInterfaceImplementer(address(this), keccak256("ERC777Token"), address(this));
      ERC1820_REGISTRY.setInterfaceImplementer(address(this), keccak256("ERC20Token"), address(this));
  }

  /**
    * @dev See {IERC777-name}.
    */
  function name() public view returns (string memory) {
      return _name;
  }

  /**
    * @dev See {IERC777-symbol}.
    */
  function symbol() public view returns (string memory) {
      return _symbol;
  }

  /**
    * @dev See {ERC20Detailed-decimals}.
    *
    * Always returns 18, as per the
    * [ERC777 EIP](https://eips.ethereum.org/EIPS/eip-777#backward-compatibility).
    */
  function decimals() public pure returns (uint8) {
      return 18;
  }

  /**
    * @dev See {IERC777-granularity}.
    *
    * This implementation always returns `1`.
    */
  function granularity() public view returns (uint256) {
      return 1;
  }

  /**
    * @dev See {IERC777-totalSupply}.
    */
  function totalSupply() public view returns (uint256) {
      return committedSupply();
  }

  /**
    * @dev See {IERC777-send}.
    *
    * Also emits a {Transfer} event for ERC20 compatibility.
    */
  function send(address recipient, uint256 amount, bytes calldata data) external {
      _send(msg.sender, msg.sender, recipient, amount, data, "");
  }

  /**
    * @dev See {IERC20-transfer}.
    *
    * Unlike `send`, `recipient` is _not_ required to implement the {IERC777Recipient}
    * interface if it is a contract.
    *
    * Also emits a {Sent} event.
    */
  function transfer(address recipient, uint256 amount) external returns (bool) {
      require(recipient != address(0), "ERC777: transfer to the zero address");

      address from = msg.sender;

      _callTokensToSend(from, from, recipient, amount, "", "");

      _move(from, from, recipient, amount, "", "");

      _callTokensReceived(from, from, recipient, amount, "", "", false);

      return true;
  }

  /**
    * @dev See {IERC777-burn}.
    *
    * Also emits a {Transfer} event for ERC20 compatibility.
    */
  function burn(uint256 amount, bytes calldata data) external {
      _burn(msg.sender, msg.sender, amount, data, "");
  }

  /**
    * @dev See {IERC777-isOperatorFor}.
    */
  function isOperatorFor(
      address operator,
      address tokenHolder
  ) public view returns (bool) {
      return operator == tokenHolder ||
          (_defaultOperators[operator] && !_revokedDefaultOperators[tokenHolder][operator]) ||
          _operators[tokenHolder][operator];
  }

  /**
    * @dev See {IERC777-authorizeOperator}.
    */
  function authorizeOperator(address operator) external {
      require(msg.sender != operator, "ERC777: authorizing self as operator");

      if (_defaultOperators[operator]) {
          delete _revokedDefaultOperators[msg.sender][operator];
      } else {
          _operators[msg.sender][operator] = true;
      }

      emit AuthorizedOperator(operator, msg.sender);
  }

  /**
    * @dev See {IERC777-revokeOperator}.
    */
  function revokeOperator(address operator) external {
      require(operator != msg.sender, "ERC777: revoking self as operator");

      if (_defaultOperators[operator]) {
          _revokedDefaultOperators[msg.sender][operator] = true;
      } else {
          delete _operators[msg.sender][operator];
      }

      emit RevokedOperator(operator, msg.sender);
  }

  /**
    * @dev See {IERC777-defaultOperators}.
    */
  function defaultOperators() public view returns (address[] memory) {
      return _defaultOperatorsArray;
  }

  /**
    * @dev See {IERC777-operatorSend}.
    *
    * Emits {Sent} and {Transfer} events.
    */
  function operatorSend(
      address sender,
      address recipient,
      uint256 amount,
      bytes calldata data,
      bytes calldata operatorData
  )
  external
  {
      require(isOperatorFor(msg.sender, sender), "ERC777: caller is not an operator for holder");
      _send(msg.sender, sender, recipient, amount, data, operatorData);
  }

  /**
    * @dev See {IERC777-operatorBurn}.
    *
    * Emits {Burned} and {Transfer} events.
    */
  function operatorBurn(address account, uint256 amount, bytes calldata data, bytes calldata operatorData) external {
      require(isOperatorFor(msg.sender, account), "ERC777: caller is not an operator for holder");
      _burn(msg.sender, account, amount, data, operatorData);
  }

  /**
    * @dev See {IERC20-allowance}.
    *
    * Note that operator and allowance concepts are orthogonal: operators may
    * not have allowance, and accounts with allowance may not be operators
    * themselves.
    */
  function allowance(address holder, address spender) public view returns (uint256) {
      return _allowances[holder][spender];
  }

  /**
    * @dev See {IERC20-approve}.
    *
    * Note that accounts cannot have allowance issued by their operators.
    */
  function approve(address spender, uint256 value) external returns (bool) {
      address holder = msg.sender;
      _approve(holder, spender, value);
      return true;
  }

  /**
  * @dev See {IERC20-transferFrom}.
  *
  * Note that operator and allowance concepts are orthogonal: operators cannot
  * call `transferFrom` (unless they have allowance), and accounts with
  * allowance cannot call `operatorSend` (unless they are operators).
  *
  * Emits {Sent}, {Transfer} and {Approval} events.
  */
  function transferFrom(address holder, address recipient, uint256 amount) external returns (bool) {
      require(recipient != address(0), "ERC777: transfer to the zero address");
      require(holder != address(0), "ERC777: transfer from the zero address");

      address spender = msg.sender;

      _callTokensToSend(spender, holder, recipient, amount, "", "");

      _move(spender, holder, recipient, amount, "", "");
      _approve(holder, spender, _allowances[holder][spender].sub(amount, "ERC777: transfer amount exceeds allowance"));

      _callTokensReceived(spender, holder, recipient, amount, "", "", false);

      return true;
  }

  /**
   * @notice Commits the current draw.  Mints the open supply number of tokens.
   * @dev This function deviates from the ERC 777 spec (https://eips.ethereum.org/EIPS/eip-777).  The spec
   * says that:
   *  - "The balance of the recipient MUST be increased by the amount of tokens minted."
   * However, for this contract it is not feasible to emit Minted for every open deposit.
   */
  function emitCommitted() internal {
    super.emitCommitted();
    uint256 mintingAmount = openSupply();
    _mintEvents(address(this), address(this), mintingAmount, '', '');
  }

  /**
   * @notice Awards the winnings to a user.  Ensures that the Minted event is fired
   */
  function awardWinnings(address winner, uint256 amount) internal {
    super.awardWinnings(winner, amount);
    _mint(address(this), winner, amount, '', '');
  }

  /**
    * @dev Creates `amount` tokens and assigns them to `account`, increasing
    * the total supply.
    *
    * If a send hook is registered for `account`, the corresponding function
    * will be called with `operator`, `data` and `operatorData`.
    *
    * See {IERC777Sender} and {IERC777Recipient}.
    *
    * Emits {Minted} and {IERC20-Transfer} events.
    *
    * Requirements
    *
    * - `account` cannot be the zero address.
    * - if `account` is a contract, it must implement the {IERC777Recipient}
    * interface.
    */
  function _mint(
      address operator,
      address account,
      uint256 amount,
      bytes memory userData,
      bytes memory operatorData
  )
  internal
  {
      _callTokensReceived(operator, address(0), account, amount, userData, operatorData, true);
      _mintEvents(operator, account, amount, userData, operatorData);
  }

  function _mintEvents(
      address operator,
      address account,
      uint256 amount,
      bytes memory userData,
      bytes memory operatorData
  )
  internal
  {
      emit Minted(operator, account, amount, userData, operatorData);
      emit Transfer(address(0), account, amount);
  }

  /**
    * @dev Send tokens
    * @param operator address operator requesting the transfer
    * @param from address token holder address
    * @param to address recipient address
    * @param amount uint256 amount of tokens to transfer
    * @param userData bytes extra information provided by the token holder (if any)
    * @param operatorData bytes extra information provided by the operator (if any)
    */
  function _send(
      address operator,
      address from,
      address to,
      uint256 amount,
      bytes memory userData,
      bytes memory operatorData
  )
      private
  {
      require(from != address(0), "ERC777: send from the zero address");
      require(to != address(0), "ERC777: send to the zero address");

      _callTokensToSend(operator, from, to, amount, userData, operatorData);

      _move(operator, from, to, amount, userData, operatorData);

      _callTokensReceived(operator, from, to, amount, userData, operatorData, true);
  }

  /**
    * @dev Burn tokens
    * @param operator address operator requesting the operation
    * @param from address token holder address
    * @param amount uint256 amount of tokens to burn
    * @param data bytes extra information provided by the token holder
    * @param operatorData bytes extra information provided by the operator (if any)
    */
  function _burn(
      address operator,
      address from,
      uint256 amount,
      bytes memory data,
      bytes memory operatorData
  )
      private
  {
      require(from != address(0), "ERC777: burn from the zero address");
      uint256 committedBalance = drawState.committedBalanceOf(from);
      require(amount <= committedBalance, "not enough funds");

      _callTokensToSend(operator, from, address(0), amount, data, operatorData);

      // Update state variables
      drawState.withdrawCommitted(from, amount);
      _withdraw(from, amount);

      emit Burned(operator, from, amount, data, operatorData);
      emit Transfer(from, address(0), amount);
  }

  function _move(
      address operator,
      address from,
      address to,
      uint256 amount,
      bytes memory userData,
      bytes memory operatorData
  )
      private
  {
      balances[from] = balances[from].sub(amount, "move could not sub amount");
      balances[to] = balances[to].add(amount);
      drawState.withdrawCommitted(from, amount);
      drawState.depositCommitted(to, amount);

      emit Sent(operator, from, to, amount, userData, operatorData);
      emit Transfer(from, to, amount);
  }

  function _approve(address holder, address spender, uint256 value) private {
      require(spender != address(0), "ERC777: approve to the zero address");

      _allowances[holder][spender] = value;
      emit Approval(holder, spender, value);
  }

  /**
    * @dev Call from.tokensToSend() if the interface is registered
    * @param operator address operator requesting the transfer
    * @param from address token holder address
    * @param to address recipient address
    * @param amount uint256 amount of tokens to transfer
    * @param userData bytes extra information provided by the token holder (if any)
    * @param operatorData bytes extra information provided by the operator (if any)
    */
  function _callTokensToSend(
      address operator,
      address from,
      address to,
      uint256 amount,
      bytes memory userData,
      bytes memory operatorData
  )
      internal
  {
      address implementer = ERC1820_REGISTRY.getInterfaceImplementer(from, TOKENS_SENDER_INTERFACE_HASH);
      if (implementer != address(0)) {
          IERC777Sender(implementer).tokensToSend(operator, from, to, amount, userData, operatorData);
      }
  }

  /**
    * @dev Call to.tokensReceived() if the interface is registered. Reverts if the recipient is a contract but
    * tokensReceived() was not registered for the recipient
    * @param operator address operator requesting the transfer
    * @param from address token holder address
    * @param to address recipient address
    * @param amount uint256 amount of tokens to transfer
    * @param userData bytes extra information provided by the token holder (if any)
    * @param operatorData bytes extra information provided by the operator (if any)
    */
  function _callTokensReceived(
      address operator,
      address from,
      address to,
      uint256 amount,
      bytes memory userData,
      bytes memory operatorData,
      bool requireReceptionAck
  )
      private
  {
      address implementer = ERC1820_REGISTRY.getInterfaceImplementer(to, TOKENS_RECIPIENT_INTERFACE_HASH);
      if (implementer != address(0)) {
          IERC777Recipient(implementer).tokensReceived(operator, from, to, amount, userData, operatorData);
      } else if (requireReceptionAck) {
          require(!to.isContract(), "ERC777: contract recipient has no implementer for ERC777TokensRecipient");
      }
  }
}
