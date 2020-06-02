pragma solidity ^0.6.4;

import "./ModuleManager.sol";

contract Module {
    ModuleManager public manager;

    modifier authorized() virtual {
        require(msg.sender == address(manager), "Method can only be called from manager");
        _;
    }

    function setManager(ModuleManager _manager)
        internal
    {
        // console.log("Module#setManager entered %s", address(_manager));
        // manager can only be 0 at initalization of contract.
        // Check ensures that setup function can only be called once.
        require(address(manager) == address(0), "Manager has already been set");
        require(address(_manager) != address(0), "Manager is zero");
        // console.log("Module#setManager setting...");
        manager = _manager;
    }
}