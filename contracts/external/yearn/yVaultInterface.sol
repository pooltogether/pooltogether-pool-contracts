pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

interface yVaultInterface is IERC20 {
    function token() external view returns (IERC20);

    function balance() external view returns (uint256);
    
    function deposit(uint256 _amount) external;
    
    function withdraw(uint256 _shares) external;
    
    function getPricePerFullShare() external view returns (uint256);
}