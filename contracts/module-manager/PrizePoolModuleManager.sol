pragma solidity ^0.6.4;

import "../base/OwnableModuleManager.sol";
import "../Constants.sol";
import "../modules/yield-service/YieldServiceInterface.sol";
import "../modules/ticket/Ticket.sol";
import "../modules/loyalty/Loyalty.sol";
import "../modules/sponsorship/Sponsorship.sol";
import "../modules/periodic-prize-pool/PeriodicPrizePoolInterface.sol";

contract PrizePoolModuleManager is OwnableModuleManager {

  function yieldService() public view returns (YieldServiceInterface) {
    return YieldServiceInterface(Constants.REGISTRY.getInterfaceImplementer(address(this), Constants.YIELD_SERVICE_INTERFACE_HASH));
  }

  function ticket() public view returns (Ticket) {
    return Ticket(Constants.REGISTRY.getInterfaceImplementer(address(this), Constants.TICKET_INTERFACE_HASH));
  }

  function loyalty() public view returns (Loyalty) {
    return Loyalty(Constants.REGISTRY.getInterfaceImplementer(address(this), Constants.LOYALTY_INTERFACE_HASH));
  }

  function sponsorship() public view returns (Sponsorship) {
    return Sponsorship(Constants.REGISTRY.getInterfaceImplementer(address(this), Constants.LOYALTY_INTERFACE_HASH));
  }

  function timelock() public view returns (Timelock) {
    return Timelock(Constants.REGISTRY.getInterfaceImplementer(address(this), Constants.TIMELOCK_INTERFACE_HASH));
  }

  function prizePool() public view returns (PeriodicPrizePoolInterface) {
    return PeriodicPrizePoolInterface(Constants.REGISTRY.getInterfaceImplementer(address(this), Constants.PRIZE_POOL_INTERFACE_HASH));
  }

}