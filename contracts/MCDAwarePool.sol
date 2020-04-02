/**
Copyright 2020 PoolTogether Inc.

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
import "scd-mcd-migration/src/ScdMcdMigration.sol";
import { GemLike } from "scd-mcd-migration/src/Interfaces.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";

/**
 * @title MCDAwarePool
 * @author Brendan Asselstine brendan@pooltogether.us
 * @notice This contract is a Pool that is aware of the new Multi-Collateral Dai.  It uses the ERC777Recipient interface to
 * detect if it's being transferred tickets from the old single collateral Dai (Sai) Pool.  If it is, it migrates the Sai to Dai
 * and immediately deposits the new Dai as committed tickets for that user.  We are knowingly bypassing the committed period for
 * users to encourage them to migrate to the MCD Pool.
 */
contract MCDAwarePool is BasePool, IERC777Recipient {
  IERC1820Registry constant internal ERC1820_REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);

  // keccak256("ERC777TokensRecipient")
  bytes32 constant internal TOKENS_RECIPIENT_INTERFACE_HASH =
      0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b;

  uint256 internal constant DEFAULT_LOCK_DURATION = 40;
  uint256 internal constant DEFAULT_COOLDOWN_DURATION = 80;

  /**
   * @notice The address of the ScdMcdMigration contract (see https://github.com/makerdao/developerguides/blob/master/mcd/upgrading-to-multi-collateral-dai/upgrading-to-multi-collateral-dai.md#direct-integration-with-smart-contracts)
   */
  ScdMcdMigration public scdMcdMigration;

  /**
   * @notice The address of the Sai Pool contract
   */
  MCDAwarePool public saiPool;

  /**
   * @notice Initializes the contract.
   * @param _owner The initial administrator of the contract
   * @param _cToken The Compound cToken to bind this Pool to
   * @param _feeFraction The fraction of the winnings to give to the beneficiary
   * @param _feeBeneficiary The beneficiary who receives the fee
   */
  function init (
    address _owner,
    address _cToken,
    uint256 _feeFraction,
    address _feeBeneficiary,
    uint256 lockDuration,
    uint256 cooldownDuration
  ) public initializer {
    super.init(
      _owner,
      _cToken,
      _feeFraction,
      _feeBeneficiary,
      lockDuration,
      cooldownDuration
    );
    initRegistry();
    initBlocklock(lockDuration, cooldownDuration);
  }

  /**
   * @notice Used to initialize the BasePool contract after an upgrade.  Registers the MCDAwarePool with the ERC1820 registry so that it can receive tokens, and inits the block lock.
   */
  function initMCDAwarePool(uint256 lockDuration, uint256 cooldownDuration) public {
    initRegistry();
    if (blocklock.lockDuration == 0) {
      initBlocklock(lockDuration, cooldownDuration);
    }
  }

  function initRegistry() internal {
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  function initMigration(ScdMcdMigration _scdMcdMigration, MCDAwarePool _saiPool) public onlyAdmin {
    _initMigration(_scdMcdMigration, _saiPool);
  }

  function _initMigration(ScdMcdMigration _scdMcdMigration, MCDAwarePool _saiPool) internal {
    require(address(scdMcdMigration) == address(0), "Pool/init");
    require(address(_scdMcdMigration) != address(0), "Pool/mig-def");
    scdMcdMigration = _scdMcdMigration;
    saiPool = _saiPool; // may be null
  }

  /**
   * @notice Called by an ERC777 token when tokens are sent, transferred, or minted.  If the sender is the original Sai Pool
   * and this pool is bound to the Dai token then it will accept the transfer, migrate the tokens, and deposit on behalf of
   * the sender.  It will reject all other tokens.
   *
   * If there is a committed draw this function will mint the user tickets immediately, otherwise it will place them in the
   * open prize.  This is to encourage migration.
   *
   * @param from The sender
   * @param amount The amount they are transferring
   */
  function tokensReceived(
    address, // operator
    address from,
    address, // to address can't be anything but us because we don't implement ERC1820ImplementerInterface
    uint256 amount,
    bytes calldata,
    bytes calldata
  ) external unlessDepositsPaused {
    require(msg.sender == address(saiPoolToken()), "Pool/sai-only");
    require(address(token()) == address(daiToken()), "Pool/not-dai");

    // cash out of the Pool.  This call transfers sai to this contract
    saiPoolToken().redeem(amount, '');

    // approve of the transfer to the migration contract
    saiToken().approve(address(scdMcdMigration), amount);

    // migrate the sai to dai.  The contract now has dai
    scdMcdMigration.swapSaiToDai(amount);

    if (currentCommittedDrawId() > 0) {
      // now deposit the dai as tickets
      _depositPoolFromCommitted(from, amount);
    } else {
      _depositPoolFrom(from, amount);
    }
  }

  /**
   * @notice Returns the address of the PoolSai pool token contract
   * @return The address of the Sai PoolToken contract
   */
  function saiPoolToken() internal view returns (PoolToken) {
    if (address(saiPool) != address(0)) {
      return saiPool.poolToken();
    } else {
      return PoolToken(0);
    }
  }

  /**
   * @notice Returns the address of the Sai token
   * @return The address of the sai token
   */
  function saiToken() public returns (GemLike) {
    return scdMcdMigration.saiJoin().gem();
  }

  /**
   * @notice Returns the address of the Dai token
   * @return The address of the Dai token.
   */
  function daiToken() public returns (GemLike) {
    return scdMcdMigration.daiJoin().dai();
  }
}
