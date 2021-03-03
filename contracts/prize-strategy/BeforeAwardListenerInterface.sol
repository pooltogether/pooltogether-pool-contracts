// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts-upgradeable/introspection/IERC165Upgradeable.sol";

/* solium-disable security/no-block-members */
interface BeforeAwardListenerInterface is IERC165Upgradeable {
  function beforePrizePoolAwarded(uint256 randomNumber, uint256 prizePeriodStartedAt) external;
}
