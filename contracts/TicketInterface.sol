pragma solidity ^0.6.4;

interface TicketInterface {
  function draw(uint256 tokenIndex) external view returns (address);
}