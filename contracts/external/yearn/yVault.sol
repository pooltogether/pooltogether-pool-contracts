pragma solidity 0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

abstract contract yVault is ERC20UpgradeSafe {
    function token() external virtual view returns (address);

    function balance() external virtual view returns (uint);
    
    function deposit(uint _amount) external virtual;
    
    function withdraw(uint _shares) external virtual;
    
    function getPricePerFullShare() external virtual view returns (uint);
}