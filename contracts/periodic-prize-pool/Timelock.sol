pragma solidity 0.6.4;

import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/uniform-random-number/contracts/UniformRandomNumber.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@nomiclabs/buidler/console.sol";

import "./InterestTracker.sol";

/* solium-disable security/no-block-members */
abstract contract Timelock is ContextUpgradeSafe, InterestTracker {
  using SafeMath for uint256;

  event CollateralTimelocked(address indexed operator, address indexed to, uint256 amount, uint256 unlockTimestamp);
  event CollateralSwept(address indexed operator, address indexed to, uint256 amount);

  uint256 public totalSupply;
  mapping(address => uint256) internal timelockBalances;
  mapping(address => uint256) internal unlockTimestamps; // balanceOfAvailableAt

  function sweep(address[] memory users) public returns (uint256) {
    address sender = _msgSender();
    uint256 totalWithdrawal;

    // first gather the total withdrawal and fee
    uint256 i;
    for (i = 0; i < users.length; i++) {
      address user = users[i];
      if (unlockTimestamps[user] <= block.timestamp) {
        totalWithdrawal = totalWithdrawal.add(timelockBalances[user]);
      }
    }

    // pull out the collateral
    if (totalWithdrawal > 0) {
      _redeem(totalWithdrawal);
    }

    for (i = 0; i < users.length; i++) {
      address user = users[i];
      if (unlockTimestamps[user] <= block.timestamp) {
        uint256 balance = timelockBalances[user];
        if (balance > 0) {
          _burn(user, balance);
          delete unlockTimestamps[user];
          IERC20(_token()).transfer(user, balance);
          emit CollateralSwept(sender, user, balance);
        }
      }
    }
  }

  function mintTo(address to, uint256 amount, uint256 unlockTimestamp) public {
    timelockBalances[to] = timelockBalances[to].add(amount);
    totalSupply = totalSupply.add(amount);
    unlockTimestamps[to] = unlockTimestamp;

    emit CollateralTimelocked(_msgSender(), to, amount, unlockTimestamp);
  }

  function _burn(address user, uint256 amount) internal {
    timelockBalances[user] = timelockBalances[user].sub(amount);
    totalSupply = totalSupply.sub(amount);
  }

  function timelockBalanceAvailableAt(address user) public view returns (uint256) {
    return unlockTimestamps[user];
  }

  function timelockBalanceOf(address user) public view returns (uint256) {
    return timelockBalances[user];
  }
}