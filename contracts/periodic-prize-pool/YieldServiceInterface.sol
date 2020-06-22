pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

interface YieldServiceInterface {
  function token() external view returns (IERC20);
}