pragma solidity ^0.6.4;

import "@nomiclabs/buidler/console.sol";

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
        // console.log("Module#setManager entered %s", address(_manager));
        // manager can only be 0 at initalization of contract.
        // Check ensures that setup function can only be called once.
        require(address(manager) == address(0), "Manager has already been set");
        // console.log("Module#setManager setting...");
        manager = _manager;
    }
}