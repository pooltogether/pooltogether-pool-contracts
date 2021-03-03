pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "../prize-strategy/SablierManager.sol";

/* solium-disable security/no-block-members */
contract SablierManagerHarness is SablierManager {

  constructor(ISablier _sablier) public SablierManager(_sablier) {
  }

  function setSablierStreamId(address prizePool, uint256 streamId) external {
    sablierStreamIds[prizePool] = streamId;
  }

}