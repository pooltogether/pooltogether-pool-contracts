pragma solidity ^0.6.4;

library MappedSinglyLinkedList {

  address public constant SENTINAL_TOKEN = address(0x1);

  struct Mapping {
    uint256 count;
    mapping(address => address) addressMap;
  }

  function addressArray(Mapping storage self) internal view returns (address[] memory) {
    address[] memory array = new address[](self.count);
    uint256 count;
    address currentToken = self.addressMap[SENTINAL_TOKEN];
    // console.log("currentToken: %s", currentToken);
    while (currentToken != address(0) && currentToken != SENTINAL_TOKEN) {
      array[count] = currentToken;
      currentToken = self.addressMap[currentToken];
      // console.log("currentToken: %s", currentToken);
      count++;
    }
    return array;
  }

  function initialize(Mapping storage self, address[] memory addresses) internal {
    uint256 count = 0;
    self.addressMap[SENTINAL_TOKEN] = SENTINAL_TOKEN;
    for (uint256 i = 0; i < addresses.length; i++) {
      self.addressMap[addresses[i]] = self.addressMap[SENTINAL_TOKEN];
      self.addressMap[SENTINAL_TOKEN] = addresses[i];
      count += 1;
    }
    // console.log("sentinal initialized to %s", self.addressMap[SENTINAL_TOKEN]);
    self.count = count;
  }

  function contains(Mapping storage self, address addr) internal view returns (bool) {
    return addr != address(0) && self.addressMap[addr] != address(0);
  }
}