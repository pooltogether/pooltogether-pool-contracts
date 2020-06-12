pragma solidity ^0.6.4;

import "../base/OwnableModuleManager.sol";
import "../Constants.sol";
import "../modules/yield-service/YieldServiceInterface.sol";
import "../modules/ticket/Ticket.sol";
import "../modules/interest-tracker/InterestTrackerInterface.sol";
import "../modules/sponsorship/Sponsorship.sol";
import "../modules/periodic-prize-pool/PeriodicPrizePoolInterface.sol";

contract PrizePoolModuleManager is OwnableModuleManager {

  function yieldService() public view returns (YieldServiceInterface) {
    return YieldServiceInterface(requireModule(Constants.YIELD_SERVICE_INTERFACE_HASH));
  }

  function ticket() public view returns (Ticket) {
    return Ticket(requireModule(Constants.TICKET_INTERFACE_HASH));
  }

  function ticketCredit() public view returns (Credit) {
    return Credit(requireModule(Constants.TICKET_CREDIT_INTERFACE_HASH));
  }

  function sponsorshipCredit() public view returns (Credit) {
    return Credit(requireModule(Constants.SPONSORSHIP_CREDIT_INTERFACE_HASH));
  }

  function sponsorship() public view returns (Sponsorship) {
    return Sponsorship(requireModule(Constants.SPONSORSHIP_INTERFACE_HASH));
  }

  function timelock() public view returns (Timelock) {
    return Timelock(requireModule(Constants.TIMELOCK_INTERFACE_HASH));
  }

  function prizePool() public view returns (PeriodicPrizePoolInterface) {
    return PeriodicPrizePoolInterface(requireModule(Constants.PRIZE_POOL_INTERFACE_HASH));
  }

  function interestTracker() public view returns (InterestTrackerInterface) {
    return InterestTrackerInterface(requireModule(Constants.INTEREST_TRACKER_INTERFACE_HASH));
  }

}
