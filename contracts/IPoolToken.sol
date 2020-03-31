pragma solidity 0.5.12;

interface IPoolToken {
    function pool() external view returns (address);
    function poolMint(uint256 amount) external;
    function poolRedeem(address from, uint256 amount) external;
    function redeem(uint256 amount, bytes calldata data) external;
}