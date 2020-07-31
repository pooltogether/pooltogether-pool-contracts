pragma solidity ^0.6.4;

/// @notice An efficient implementation of a singly linked list of addresses
/// @dev A mapping(address => address) tracks the 'next' pointer.  A special address called the SENTINAL is used to denote the beginning and end of the list.
library MappedSinglyLinkedList {

  /// @notice The special value address used to denote the end of the list
  address public constant SENTINAL = address(0x1);

  /// @notice The data structure to use for the list.
  struct Mapping {
    /// @notice How many elements are in the list
    uint256 count;

    /// @notice The data structure used to map the "next" addresses.  The value of this mapping is the "next" address for the key.
    mapping(address => address) addressMap;
  }

  /// @notice Initializes the list.
  /// @dev It is important that this is called so that the SENTINAL is correctly setup.
  function initialize(Mapping storage self) internal {
    self.addressMap[SENTINAL] = SENTINAL;
    self.count = 0;
  }

  /// @notice Initializes the list with an array of addresses.
  /// @param self The Mapping struct that this function is attached to
  /// @param addresses The addresses to be added to the list.  They will be added in reverse order.
  function initialize(Mapping storage self, address[] memory addresses) internal {
    uint256 count = 0;
    self.addressMap[SENTINAL] = SENTINAL;
    for (uint256 i = 0; i < addresses.length; i++) {
      self.addressMap[addresses[i]] = self.addressMap[SENTINAL];
      self.addressMap[SENTINAL] = addresses[i];
      count += 1;
    }
    // console.log("sentinal initialized to %s", self.addressMap[SENTINAL]);
    self.count = count;
  }

  /// @notice Adds an address to the front of the list.
  /// @param self The Mapping struct that this function is attached to
  /// @param newAddress The address to shift to the front of the list
  function addAddress(Mapping storage self, address newAddress) internal {
    require(newAddress != SENTINAL && newAddress != address(0), "Invalid address");
    require(self.addressMap[newAddress] == address(0), "Already added");
    self.addressMap[newAddress] = self.addressMap[SENTINAL];
    self.addressMap[SENTINAL] = newAddress;
    self.count = self.count + 1;
  }

  /// @notice Removes an address from the list
  /// @param self The Mapping struct that this function is attached to
  /// @param prevAddress The address that precedes the address to be removed.  This may be the SENTINAL if at the start.
  /// @param addr The address to remove from the list.
  function removeAddress(Mapping storage self, address prevAddress, address addr) internal {
    require(addr != SENTINAL && addr != address(0), "Invalid address");
    require(self.addressMap[prevAddress] == addr, "Invalid prevAddress");
    self.addressMap[prevAddress] = self.addressMap[addr];
    self.addressMap[addr] = address(0);
    self.count = self.count - 1;
  }

  /// @notice Determines whether the list contains the given address
  /// @param self The Mapping struct that this function is attached to
  /// @param addr The address to check
  /// @return True if the address is contained, false otherwise.
  function contains(Mapping storage self, address addr) internal view returns (bool) {
    return addr != address(0) && self.addressMap[addr] != address(0);
  }

  /// @notice Returns an address array of all the addresses in this list
  /// @dev Contains a for loop, so complexity is O(n) wrt the list size
  /// @param self The Mapping struct that this function is attached to
  /// @return An array of all the addresses
  function addressArray(Mapping storage self) internal view returns (address[] memory) {
    address[] memory array = new address[](self.count);
    uint256 count;
    address currentToken = self.addressMap[SENTINAL];
    while (currentToken != address(0) && currentToken != SENTINAL) {
      array[count] = currentToken;
      currentToken = self.addressMap[currentToken];
      count++;
    }
    return array;
  }

  /// @notice Removes every address from the list
  /// @param self The Mapping struct that this function is attached to
  function clearAll(Mapping storage self) internal {
    address currentToken = self.addressMap[SENTINAL];
    while (currentToken != address(0) && currentToken != SENTINAL) {
      address nextToken = self.addressMap[currentToken];
      delete self.addressMap[currentToken];
      currentToken = nextToken;
    }
    self.addressMap[SENTINAL] = SENTINAL;
    self.count = 0;
  }
}
