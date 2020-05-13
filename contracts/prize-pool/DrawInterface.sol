pragma solidity ^0.6.4;

interface DrawInterface {
  function draw(uint256 randomNumber) external view returns (address);
}