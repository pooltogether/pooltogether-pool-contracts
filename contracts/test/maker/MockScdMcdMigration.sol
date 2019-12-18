pragma solidity 0.5.12;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import { GemLike } from "scd-mcd-migration/src/Interfaces.sol";
import "./MockJoinLike.sol";
import "../Token.sol";

contract MockScdMcdMigration is Initializable {

  MockJoinLike public saiJoin;
  MockJoinLike public daiJoin;
  Token public sai;
  Token public dai;

  function initialize (
    Token _sai,
    Token _dai
  ) public initializer {
    saiJoin = new MockJoinLike(address(_sai), address(0));
    daiJoin = new MockJoinLike(address(0), address(_dai));
    sai = _sai;
    dai = _dai;
  }

  function setSai(Token _sai) public {
    saiJoin = new MockJoinLike(address(_sai), address(0));
    sai = _sai;
  }

  function setDai(Token _dai) public {
    daiJoin = new MockJoinLike(address(0), address(_dai));
    dai = _dai;
  }

  function swapSaiToDai(
    uint256 wad
  ) external {
    // Get wad amount of SAI from user's wallet:
    sai.transferFrom(msg.sender, address(this), wad);
    dai.transfer(msg.sender, wad);
  }
}