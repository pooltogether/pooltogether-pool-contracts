pragma solidity ^0.6.4;

import "../base/OwnableModuleManager.sol";
import "../Constants.sol";
import "../modules/yield-service/YieldServiceInterface.sol";
import "../modules/ticket/Ticket.sol";
import "../modules/collateral/Collateral.sol";
import "../modules/sponsorship/Sponsorship.sol";
import "../modules/periodic-prize-pool/PeriodicPrizePoolInterface.sol";

contract PrizePoolModuleManager is OwnableModuleManager {

  function yieldService() public view returns (YieldServiceInterface) {
    return YieldServiceInterface(Constants.REGISTRY.getInterfaceImplementer(address(this), Constants.YIELD_SERVICE_INTERFACE_HASH));
  }

  function ticket() public view returns (Ticket) {
    return Ticket(Constants.REGISTRY.getInterfaceImplementer(address(this), Constants.TICKET_INTERFACE_HASH));
  }

  function collateral() public view returns (Collateral) {
    return Collateral(Constants.REGISTRY.getInterfaceImplementer(address(this), Constants.COLLATERAL_INTERFACE_HASH));
  }

  function sponsorship() public view returns (Sponsorship) {
    return Sponsorship(Constants.REGISTRY.getInterfaceImplementer(address(this), Constants.SPONSORSHIP_INTERFACE_HASH));
  }

  function timelock() public view returns (Timelock) {
    return Timelock(Constants.REGISTRY.getInterfaceImplementer(address(this), Constants.TIMELOCK_INTERFACE_HASH));
  }

  function prizePool() public view returns (PeriodicPrizePoolInterface) {
    return PeriodicPrizePoolInterface(Constants.REGISTRY.getInterfaceImplementer(address(this), Constants.PRIZE_POOL_INTERFACE_HASH));
  }

  function creditReserve() public view returns (CreditReserve) {
    return CreditReserve(Constants.REGISTRY.getInterfaceImplementer(address(this), Constants.CREDIT_RESERVE_INTERFACE_HASH));
  }

}
