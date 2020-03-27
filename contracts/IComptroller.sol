pragma solidity ^0.6.4;

interface IComptroller {
    function beforeTransfer(address operator, address from, address to, uint256 tokenAmount) external;
}