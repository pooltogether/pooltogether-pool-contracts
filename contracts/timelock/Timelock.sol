pragma solidity 0.6.4;

import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/uniform-random-number/contracts/UniformRandomNumber.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@nomiclabs/buidler/console.sol";

import "../token/Meta777.sol";
import "../util/ERC1820Constants.sol";
import "../base/NamedModule.sol";
import "../yield-service/YieldServiceInterface.sol";

/* solium-disable security/no-block-members */
contract Timelock is Meta777, NamedModule {

  mapping(address => uint256) unlockTimestamps;

  function initialize(
    ModuleManager _manager,
    string memory _name,
    string memory _symbol,
    address _trustedForwarder
  ) public initializer {
    setManager(_manager);
    enableInterface();
    super.initialize(_name, _symbol, _trustedForwarder);
  }

  function hashName() public view override returns (bytes32) {
    return ERC1820Constants.TIMELOCK_INTERFACE_HASH;
  }

  function sweep(address[] calldata users) external nonReentrant returns (uint256) {
    uint256 totalWithdrawal;

    // first gather the total withdrawal and fee
    uint256 i;
    for (i = 0; i < users.length; i++) {
      address user = users[i];
      if (unlockTimestamps[user] <= block.timestamp) {
        totalWithdrawal = totalWithdrawal.add(balanceOf(user));
        // console.log("sweepTimelock: totalWithdrawal %s", totalWithdrawal);
      }
    }

    // pull out the collateral
    if (totalWithdrawal > 0) {
      // console.log("sweepTimelock: redeemsponsorship %s", totalWithdrawal);
      // console.log("sweepTimelock: redeemsponsorship balance %s", outbalance);
      yieldService().redeem(address(this), totalWithdrawal);
    }

    // console.log("sweepTimelock: starting burn...");
    for (i = 0; i < users.length; i++) {
      address user = users[i];
      if (unlockTimestamps[user] <= block.timestamp) {
        uint256 balance = balanceOf(user);
        if (balance > 0) {
          // console.log("sweepTimelock: Burning %s", balance);
          _burn(user, balance, "", "");
          IERC20(yieldService().token()).transfer(user, balance);
        }
      }
    }
  }

  function mint(address to, uint256 amount, uint256 unlockTimestamp) external onlyManagerOrModule {
    _mint(to, amount, "", "");
    unlockTimestamps[to] = unlockTimestamp;
  }

  function burn(address from, uint256 amount) external onlyManagerOrModule {
    _burn(from, amount, "", "");
  }

  function balanceAvailableAt(address user) external view returns (uint256) {
    return unlockTimestamps[user];
  }

  function _beforeTokenTransfer(address operator, address from, address to, uint256 tokenAmount) internal override {
    require(from == address(0) || to == address(0), "only minting or burning is allowed");
  }

  function yieldService() public view returns (YieldServiceInterface) {
    return YieldServiceInterface(getInterfaceImplementer(ERC1820Constants.YIELD_SERVICE_INTERFACE_HASH));
  }
}