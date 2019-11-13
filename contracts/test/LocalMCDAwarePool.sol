pragma solidity ^0.5.12;

import "../MCDAwarePool.sol";

contract LocalMCDAwarePool is MCDAwarePool {
  ScdMcdMigration scdMcd;

  function scdMcdMigration() public view returns (ScdMcdMigration) {
    return scdMcd;
  }

  function initLocalMCDAwarePool(ScdMcdMigration _scdMcdMigration) public {
    scdMcd = _scdMcdMigration;
  }

  function sai() public returns (GemLike) {
    return saiToken();
  }

  function dai() public returns (GemLike) {
    return daiToken();
  }
}