pragma solidity 0.5.12;

// import { GemLike, JoinLike } from "scd-mcd-migration/src/Interfaces.sol";

contract MockJoinLike {
  address public gem;
  address public dai;

  constructor(
    address _gem,
    address _dai
  ) public {
    gem = _gem;
    dai = _dai;
  }
}