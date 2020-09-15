pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "@pooltogether/pooltogether-rng-contracts/contracts/RNGInterface.sol";

/* solium-disable security/no-block-members */
contract SingleRandomWinnerBuilder {

  struct SingleRandomWinnerConfig {
    address proxyAdmin;
    RNGInterface rngService;
    uint256 prizePeriodStart;
    uint256 prizePeriodSeconds;
    string ticketName;
    string ticketSymbol;
    string sponsorshipName;
    string sponsorshipSymbol;
    uint256 ticketCreditLimitMantissa;
    uint256 ticketCreditRateMantissa;
    address[] externalERC20Awards;
  }

}
