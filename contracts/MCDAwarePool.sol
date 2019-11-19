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

import "./ERC777Pool.sol";
import "scd-mcd-migration/src/ScdMcdMigration.sol";
import { GemLike } from "scd-mcd-migration/src/Interfaces.sol";

/**
 * @title MCDAwarePool
 * @author Brendan Asselstine brendan@pooltogether.us
 * @notice This contract is a Pool that is aware of the new Multi-Collateral Dai.  It uses the ERC777Recipient interface to
 * detect if it's being transferred tickets from the old single collateral Dai (Sai) Pool.  If it is, it migrates the Sai to Dai
 * and immediately deposits the new Dai as committed tickets for that user.  We are knowingly bypassing the committed period for
 * users to encourage them to migrate to the MCD Pool.
 */
contract MCDAwarePool is ERC777Pool, IERC777Recipient {

  /**
   * @notice Returns the address of the ScdMcdMigration contract (see https://github.com/makerdao/developerguides/blob/master/mcd/upgrading-to-multi-collateral-dai/upgrading-to-multi-collateral-dai.md#direct-integration-with-smart-contracts)
   */
  function scdMcdMigration() public view returns (ScdMcdMigration);

  /**
   * @notice Returns the address of the Sai Pool contract
   */
  function saiPool() public view returns (MCDAwarePool);

  /**
   * @notice Initializes the contract.
   * @param _owner The initial administrator of the contract
   * @param _cToken The Compound cToken to bind this Pool to
   * @param _feeFraction The fraction of the winnings to give to the beneficiary
   * @param _feeBeneficiary The beneficiary who receives the fee
   * @param name The name of the Pool ticket tokens
   * @param symbol The symbol (short name) of the Pool ticket tokens
   * @param defaultOperators Addresses that should always be able to move tokens on behalf of others
   */
  function init (
    address _owner,
    address _cToken,
    uint256 _feeFraction,
    address _feeBeneficiary,
    string memory name,
    string memory symbol,
    address[] memory defaultOperators
  ) public initializer {
    super.init(
      _owner,
      _cToken,
      _feeFraction,
      _feeBeneficiary,
      name,
      symbol,
      defaultOperators
    );
    initMCDAwarePool();
  }

  function initBasePoolUpgrade(
    string memory name,
    string memory symbol,
    address[] memory defaultOperators
  ) public {
    initERC777(name, symbol, defaultOperators);
    initMCDAwarePool();
  }

  function initMCDAwarePool() public {
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  function tokensReceived(
    address, // operator
    address from,
    address, // to address can't be anything but us because we don't implement ERC1820ImplementerInterface
    uint256 amount,
    bytes calldata,
    bytes calldata
  ) external {
    require(msg.sender == address(saiPool()), "can only receive tokens from Sai Pool");
    require(address(token()) == address(daiToken()), "contract does not use Dai");

    // cash out of the Pool.  This call transfers sai to this contract
    saiPool().burn(amount, '');

    // approve of the transfer to the migration contract
    saiToken().approve(address(scdMcdMigration()), amount);

    // migrate the sai to dai.  The contract now has dai
    scdMcdMigration().swapSaiToDai(amount);

    if (currentCommittedDrawId() > 0) {
      // now deposit the dai as tickets
      _depositPoolFromCommitted(from, amount);
    } else {
      _depositPoolFrom(from, amount);
    }
  }

  function saiToken() internal returns (GemLike) {
    return scdMcdMigration().saiJoin().gem();
  }

  function daiToken() internal returns (GemLike) {
    return scdMcdMigration().daiJoin().dai();
  }
}
