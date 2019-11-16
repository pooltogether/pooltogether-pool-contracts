pragma solidity 0.5.12;

import "./MCDAwarePool.sol";
import "scd-mcd-migration/src/ScdMcdMigration.sol";

contract Pool is MCDAwarePool {
  function scdMcdMigration() public view returns (ScdMcdMigration) {
    return ScdMcdMigration(0xc73e0383F3Aff3215E6f04B0331D58CeCf0Ab849);
  }
}