pragma solidity 0.6.4;

interface CTokenInterface {
    function underlying() external view returns (address);
    function balanceOfUnderlying(address owner) external returns (uint256);
    function supplyRatePerBlock() external returns (uint256);
    function exchangeRateCurrent() external returns (uint256);
    function mint(uint256 mintAmount) external returns (uint256);
    function balanceOf(address user) external view returns (uint256);
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
}
