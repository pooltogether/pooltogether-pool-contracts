pragma solidity ^0.5.12;

import "../MCDAwarePool.sol";

contract LocalMCDAwarePool is MCDAwarePool {
  ScdMcdMigration scdMcd;
  MCDAwarePool pool;

  function scdMcdMigration() public view returns (ScdMcdMigration) {
    return scdMcd;
  }

  function saiPool() public view returns (MCDAwarePool) {
    return pool;
  }

  function initLocalMCDAwarePool(ScdMcdMigration _scdMcdMigration, MCDAwarePool _saiPool) public {
    scdMcd = _scdMcdMigration;
    pool = _saiPool;
  }

  function sai() public returns (GemLike) {
    return saiToken();
  }

  function dai() public returns (GemLike) {
    return daiToken();
  }
}