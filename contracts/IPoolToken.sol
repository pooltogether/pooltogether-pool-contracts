pragma solidity 0.5.12;

import "./BasePool.sol";

contract IPoolToken {
    function pool() public view returns (BasePool);
    function poolMint(uint256 amount) external;
    function poolRedeem(address from, uint256 amount) external;
    function redeem(uint256 amount, bytes calldata data) external;
    function _callTokensToSend(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes memory userData,
        bytes memory operatorData
    ) internal;
}