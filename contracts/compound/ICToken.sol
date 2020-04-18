pragma solidity 0.6.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract ICToken is IERC20 {
    function underlying() external virtual view returns (address);
    function balanceOfUnderlying(address owner) external virtual returns (uint256);
    function supplyRatePerBlock() external virtual view returns (uint256);
    function exchangeRateCurrent() external virtual returns (uint256);
    function exchangeRateStored() external virtual view returns (uint256);
    function mint(uint256 mintAmount) external virtual returns (uint256);
    function redeem(uint256 redeemTokens) external virtual returns (uint256);
    function redeemUnderlying(uint256 redeemAmount) external virtual returns (uint256);
}