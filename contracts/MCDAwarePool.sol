pragma solidity ^0.5.12;

import "./Pool.sol";
import "scd-mcd-migration/src/ScdMcdMigration.sol";
import { GemLike } from "scd-mcd-migration/src/Interfaces.sol";

contract MCDAwarePool is Pool, IERC777Recipient {

  // keccak("PoolTogether.MCDAwarePool")
  bytes32 public constant MCD_AWARE_POOL_INTERFACE_HASH = 0xf07efa750d04abfb9556d73b16e6ffb37436eb789c2a8fd17117e0bf232a506c;

  function scdMcdMigration() public view returns (ScdMcdMigration) {
    revert("not implemented");
  }

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

  function initMCDAwarePool() public {
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), MCD_AWARE_POOL_INTERFACE_HASH, address(this));
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  function tokensReceived(
    address,
    address from,
    address to,
    uint256 amount,
    bytes calldata,
    bytes calldata
  ) external {
    require(to == address(this), "does not receive for others");

    // if this is a migration transaction
    if (shouldMigrateTokensReceived(msg.sender)) {
      migrateTokensReceived(msg.sender, from, amount);
    } else if (msg.sender == address(token())) { // if we are receiving tokens we know
      _depositPoolFrom(from, amount);
    } else { // fail if it's an unrecognized token
      revert("cannot receive unknown token");
    }
  }

  function shouldMigrateTokensReceived(address sender) internal returns (bool) {
    MCDAwarePool mcdPool = getMCDAwarePoolImplementor(sender);
    bool isMcdPool = address(mcdPool) != address(0);
    require(isMcdPool, "is not an MCD pool");
    bool receivingPoolSai = mcdPool.cToken().underlying() == address(saiToken());
    require(receivingPoolSai, "is not receiving pool sai");
    bool weAreDai = address(token()) == address(daiToken());
    require(weAreDai, " we are not dai");
    return (
      isMcdPool && // mcdPool is defined
      mcdPool.cToken().underlying() == address(saiToken()) && // we are receiving Pool Sai
      address(token()) == address(daiToken()) // we are Pool Dai
    );
  }

  function migrateTokensReceived(address sender, address from, uint256 amount) internal {
    MCDAwarePool mcdPool = getMCDAwarePoolImplementor(sender);

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
