pragma solidity 0.6.4;

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

  function addAddress(Mapping storage self, address newAddress) internal {
    require(newAddress != SENTINAL_TOKEN && newAddress != address(0), "Invalid address");
    require(self.addressMap[newAddress] == address(0), "Already added");
    self.addressMap[newAddress] = self.addressMap[SENTINAL_TOKEN];
    self.addressMap[SENTINAL_TOKEN] = newAddress;
    self.count = self.count + 1;
  }

  function removeAddress(Mapping storage self, address prevAddress, address addr) internal {
    require(addr != SENTINAL_TOKEN && addr != address(0), "Invalid address");
    require(self.addressMap[prevAddress] == addr, "Invalid prevAddress");
    self.addressMap[prevAddress] = self.addressMap[addr];
    self.addressMap[addr] = address(0);
    self.count = self.count - 1;
  }

  function initialize(Mapping storage self) internal {
    self.addressMap[SENTINAL_TOKEN] = SENTINAL_TOKEN;
    self.count = 0;
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

  function clearAll(Mapping storage self) internal {
    address currentToken = self.addressMap[SENTINAL_TOKEN];
    while (currentToken != address(0) && currentToken != SENTINAL_TOKEN) {
      address nextToken = self.addressMap[currentToken];
      self.addressMap[currentToken] = address(0);
      currentToken = nextToken;
    }
    self.count = 0;
  }
}