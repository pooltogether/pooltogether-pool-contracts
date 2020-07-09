pragma solidity ^0.6.4;

import "../PrizePool.sol";
import "./CompoundYieldService.sol";

contract CompoundPrizePool is PrizePool, CompoundYieldService {
  function initialize (
    address _trustedForwarder,
    ComptrollerInterface _comptroller,
    address[] memory _controlledTokens,
    CTokenInterface _cToken
  ) public initializer {
    PrizePool.initialize(
      _trustedForwarder,
      _comptroller,
      _controlledTokens
    );
    cToken = _cToken;
  }
}