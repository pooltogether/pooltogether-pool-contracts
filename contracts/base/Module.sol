pragma solidity ^0.6.4;

import "./ModuleManager.sol";

contract Module {
    ModuleManager public manager;

    modifier onlyManager() virtual {
        require(msg.sender == address(manager), "Method can only be called from manager");
        _;
    }

    modifier onlyManagerOrModule() virtual {
        bool isModule = manager.isModuleEnabled(Module(msg.sender));
        require(isModule || msg.sender == address(manager), "Method can only be called from manager or module");
        _;
    }

    // function afterEnableModule() external virtual onlyManager {}
    // function beforeDisableModule() external virtual onlyManager {}

    function setManager(ModuleManager _manager)
        internal
    {
        // manager can only be 0 at initalization of contract.
        // Check ensures that setup function can only be called once.
        require(address(_manager) == address(0), "Manager has already been set");
        manager = _manager;
    }
}