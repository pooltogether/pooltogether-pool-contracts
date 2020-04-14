pragma solidity ^0.6.4;

interface ITokenController {
    function beforeTokenTransfer(address from, address to, uint256 tokenAmount) external;
}