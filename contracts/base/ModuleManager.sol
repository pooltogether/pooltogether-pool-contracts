pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@nomiclabs/buidler/console.sol";

import "./Module.sol";
import "./Executor.sol";
import "../util/ERC1820Constants.sol";

/// Copied from https://github.com/gnosis/safe-contracts/blob/development/contracts/base/ModuleManager.sol

contract ModuleManager is Executor, OwnableUpgradeSafe {
  event EnabledModule(Module module);
  event DisabledModule(Module module);
  event ExecutionFromModuleSuccess(address indexed module);
  event ExecutionFromModuleFailure(address indexed module);

  address internal constant SENTINEL_MODULES = address(0x1);

  mapping (address => address) internal modules;

  function construct () public virtual initializer {
    __Ownable_init();
    setupModules(address(0), "");
  }

  function setupModules(address to, bytes memory data)
    internal
  {
    require(modules[SENTINEL_MODULES] == address(0), "Modules have already been initialized");
    modules[SENTINEL_MODULES] = SENTINEL_MODULES;
    if (to != address(0))
      // Setup has to complete successfully or transaction fails.
      require(executeDelegateCall(to, data, gasleft()), "Could not finish initialization");
  }

  /// @dev Allows to add a module to the whitelist.
  ///   This can only be done via a Safe transaction.
  /// @param module Module to be whitelisted.
  function enableModule(Module module)
    public
    onlyOwner
  {
    console.log("enableModule: %s", address(module));
    // Module address cannot be null or sentinel.
    require(address(module) != address(0) && address(module) != SENTINEL_MODULES, "Invalid module address provided");
    // Module cannot be added twice.
    require(modules[address(module)] == address(0), "Module has already been added");
    console.log("ENTERED 2");
    modules[address(module)] = modules[SENTINEL_MODULES];
    console.log("ENTERED 3");
    modules[SENTINEL_MODULES] = address(module);

    (bool success, bytes32 name) = hashName(module);
    if (success) {
      console.log("set implementer: %s, %s, %s", address(this), uint256(name), address(module));
      ERC1820Constants.REGISTRY.setInterfaceImplementer(address(this), name, address(module));
    }

    console.log("enableModule done: modules[]: %s, isModuleEnabled: %s", modules[address(module)], isModuleEnabled(module));
    emit EnabledModule(module);
  }

  function getModuleByHashName(bytes32 hashName) public view returns (address) {
    return ERC1820Constants.REGISTRY.getInterfaceImplementer(address(this), hashName);
  }

  /// @dev Allows to remove a module from the whitelist.
  ///   This can only be done via a Safe transaction.
  /// @param prevModule Module that pointed to the module to be removed in the linked list
  /// @param module Module to be removed.
  function disableModule(Module prevModule, Module module)
    public
    onlyOwner
  {
    console.log("disableModule %s", address(module));
    // Validate module address and check that it corresponds to module index.
    require(address(module) != address(0) && address(module) != SENTINEL_MODULES, "Invalid module address provided");
    require(modules[address(prevModule)] == address(module), "Invalid prevModule, module pair provided");
    modules[address(prevModule)] = modules[address(module)];
    modules[address(module)] = address(0);
    (bool success, bytes32 name) = hashName(module);
    if (success) {
      ERC1820Constants.REGISTRY.setInterfaceImplementer(address(this), name, address(0));
    }
    emit DisabledModule(module);
  }

  function hashName(Module m) internal view returns (bool success, bytes32 name) {
    // console.log("checking hashName");
    (bool s, bytes memory data) = address(m).staticcall(abi.encodeWithSignature("hashName()"));
    success = s && data.length > 0;
    if (success) {
      name = abi.decode(data, (bytes32));
      // console.log("success");
    } else {
      // console.log("failure");
    }
  }
  /// @dev Allows a Module to execute a Safe transaction without any further confirmations.
  /// @param to Destination address of module transaction.
  /// @param value Ether value of module transaction.
  /// @param data Data payload of module transaction.
  /// @param operation Operation type of module transaction.
  function execTransactionFromModule(address to, uint256 value, bytes memory data, Enum.Operation operation)
    public
    returns (bool success)
  {
    // Only whitelisted modules are allowed.
    require(msg.sender != SENTINEL_MODULES && modules[msg.sender] != address(0), "Method can only be called from an enabled module");
    // Execute transaction without further confirmations.
    success = execute(to, value, data, operation, gasleft());
    if (success) emit ExecutionFromModuleSuccess(msg.sender);
    else emit ExecutionFromModuleFailure(msg.sender);
  }

  /// @dev Allows a Module to execute a Safe transaction without any further confirmations and return data
  /// @param to Destination address of module transaction.
  /// @param value Ether value of module transaction.
  /// @param data Data payload of module transaction.
  /// @param operation Operation type of module transaction.
  function execTransactionFromModuleReturnData(address to, uint256 value, bytes memory data, Enum.Operation operation)
    public
    returns (bool success, bytes memory returnData)
  {
    success = execTransactionFromModule(to, value, data, operation);
    // solium-disable-next-line security/no-inline-assembly
    assembly {
      // Load free memory location
      let ptr := mload(0x40)
      // We allocate memory for the return data by setting the free memory location to
      // current free memory location + data size + 32 bytes for data size value
      mstore(0x40, add(ptr, add(returndatasize(), 0x20)))
      // Store the size
      mstore(ptr, returndatasize())
      // Store the data
      returndatacopy(add(ptr, 0x20), 0, returndatasize())
      // Point the return data to the correct memory location
      returnData := ptr
    }
  }

  /// @dev Returns if an module is enabled
  /// @return True if the module is enabled
  function isModuleEnabled(Module module)
    public
    view
    returns (bool)
  {
    console.log("isModuleEnabled: %s", address(module));
    return SENTINEL_MODULES != address(module) && modules[address(module)] != address(0);
  }

  /// @dev Returns array of first 10 modules.
  /// @return Array of modules.
  function getModules()
    public
    view
    returns (address[] memory)
  {
    (address[] memory array,) = getModulesPaginated(SENTINEL_MODULES, 10);
    return array;
  }

  /// @param start Start of the page.
  /// @param pageSize Maximum number of modules that should be returned.
  /// @return array Array of modules.
  function getModulesPaginated(address start, uint256 pageSize)
    public
    view
    returns (address[] memory array, address next)
  {
    // Init array with max page size
    array = new address[](pageSize);

    // Populate return array
    uint256 moduleCount = 0;
    address currentModule = modules[start];
    while(currentModule != address(0x0) && currentModule != SENTINEL_MODULES && moduleCount < pageSize) {
      array[moduleCount] = currentModule;
      currentModule = modules[currentModule];
      moduleCount++;
    }
    next = currentModule;
    // Set correct size of returned array
    // solium-disable-next-line security/no-inline-assembly
    assembly {
      mstore(array, moduleCount)
    }
  }
}