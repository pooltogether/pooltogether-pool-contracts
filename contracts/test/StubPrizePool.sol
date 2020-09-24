pragma solidity >=0.6.0 <0.7.0;

import "../prize-pool/stake/StakePrizePool.sol";

contract StubPrizePool is StakePrizePool {
  constructor () public {
    _tokens.initialize();
    __Ownable_init();
    __ReentrancyGuard_init();
    maxExitFeeMantissa = uint(-1);
    maxTimelockDuration = uint(-1);
  }
}