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
   * @notice The ERC1820 interface hash that this pool implements.
   *
   * keccak("PoolTogether.MCDAwarePool")
   */
  bytes32 public constant MCD_AWARE_POOL_INTERFACE_HASH = 0xf07efa750d04abfb9556d73b16e6ffb37436eb789c2a8fd17117e0bf232a506c;

  /**
   * @notice Returns the address of the ScdMcdMigration contract (see https://github.com/makerdao/developerguides/blob/master/mcd/upgrading-to-multi-collateral-dai/upgrading-to-multi-collateral-dai.md#direct-integration-with-smart-contracts)
   */
  function scdMcdMigration() public view returns (ScdMcdMigration);

  /**
   * @notice Initializes the contract.
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
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), MCD_AWARE_POOL_INTERFACE_HASH, address(this));
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
    MCDAwarePool mcdPool = getMCDAwarePoolImplementor(msg.sender);

    require(address(mcdPool) != address(0), "sender must implement MCDAwarePool");
    require(address(mcdPool.token()) == address(saiToken()), "sender must be using Sai");
    require(address(token()) == address(daiToken()), "contract does not use Dai");

    // cash out of the Pool.  This call transfers sai to this contract
    mcdPool.burn(amount, '');

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

  function getMCDAwarePoolImplementor(address _address) public view returns (MCDAwarePool) {
    return MCDAwarePool(ERC1820_REGISTRY.getInterfaceImplementer(_address, MCD_AWARE_POOL_INTERFACE_HASH));
  }
}
