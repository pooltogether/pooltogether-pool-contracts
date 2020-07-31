pragma solidity ^0.6.4;

import "../prize-pool/MappedSinglyLinkedList.sol";

contract MappedSinglyLinkedListExposed {
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;

  MappedSinglyLinkedList.Mapping list;

  constructor (address[] memory addresses) public {
    list.initialize(addresses);
  }

  function addressArray() external view returns (address[] memory) {
    return list.addressArray();
  }

  function addAddress(address newAddress) external {
    list.addAddress(newAddress);
  }

  function removeAddress(address prevAddress, address addr) external {
    list.removeAddress(prevAddress, addr);
  }

  function contains(address addr) external view returns (bool) {
    return list.contains(addr);
  }

  function clearAll() external {
    list.clearAll();
  }

}