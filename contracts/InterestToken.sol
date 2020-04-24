pragma solidity 0.6.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./InterestTokenInterface.sol";

abstract contract InterestToken is IERC20, InterestTokenInterface {
}
