pragma solidity ^0.5.0;

interface IMoneyMarket {
  function supply(address asset, uint amount) external returns (uint);
  function withdraw(address asset, uint requestedAmount) external returns (uint);
  function getSupplyBalance(address account, address asset) view external returns (uint);
  function markets(address asset) external returns (bool,uint,address, uint,uint,uint, uint,uint,uint);
}
