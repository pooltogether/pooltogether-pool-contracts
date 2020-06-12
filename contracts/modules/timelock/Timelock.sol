pragma solidity 0.6.4;

import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/uniform-random-number/contracts/UniformRandomNumber.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@nomiclabs/buidler/console.sol";

import "../../module-manager/PrizePoolModuleManager.sol";
import "../../base/NamedModule.sol";
import "../../Constants.sol";
import "../yield-service/YieldServiceInterface.sol";

/* solium-disable security/no-block-members */
contract Timelock is NamedModule, ReentrancyGuardUpgradeSafe {
  using SafeMath for uint256;

  event CollateralTimelocked(address indexed operator, address indexed to, uint256 amount, uint256 unlockTimestamp);
  event CollateralSwept(address indexed operator, address indexed to, uint256 amount);

  uint256 public totalSupply;
  mapping(address => uint256) balances;
  mapping(address => uint256) unlockTimestamps;

  function initialize(
    NamedModuleManager _manager,
    address _trustedForwarder
  ) public initializer {
    construct(_manager, _trustedForwarder);
    __ReentrancyGuard_init();
  }

  function hashName() public view override returns (bytes32) {
    return Constants.TIMELOCK_INTERFACE_HASH;
  }

  function sweep(address[] calldata users) external nonReentrant returns (uint256) {
    address sender = _msgSender();
    uint256 totalWithdrawal;

    // first gather the total withdrawal and fee
    uint256 i;
    for (i = 0; i < users.length; i++) {
      address user = users[i];
      if (unlockTimestamps[user] <= block.timestamp) {
        totalWithdrawal = totalWithdrawal.add(balances[user]);
      }
    }

    YieldServiceInterface yieldService = PrizePoolModuleManager(address(manager)).yieldService();

    // pull out the collateral
    if (totalWithdrawal > 0) {
      yieldService.redeem(totalWithdrawal);
    }

    for (i = 0; i < users.length; i++) {
      address user = users[i];
      if (unlockTimestamps[user] <= block.timestamp) {
        uint256 balance = balances[user];
        if (balance > 0) {
          _burn(user, balance);
          delete unlockTimestamps[user];
          IERC20(yieldService.token()).transfer(user, balance);
          emit CollateralSwept(sender, user, balance);
        }
      }
    }
  }

  function mintTo(address to, uint256 amount, uint256 unlockTimestamp) external onlyManagerOrModule {
    balances[to] = balances[to].add(amount);
    totalSupply = totalSupply.add(amount);
    unlockTimestamps[to] = unlockTimestamp;

    emit CollateralTimelocked(_msgSender(), to, amount, unlockTimestamp);
  }

  function _burn(address user, uint256 amount) internal {
    balances[user] = balances[user].sub(amount);
    totalSupply = totalSupply.sub(amount);
  }

  function balanceOf(address user) external view returns (uint256) {
    return balances[user];
  }

  function balanceAvailableAt(address user) external view returns (uint256) {
    return unlockTimestamps[user];
  }
}