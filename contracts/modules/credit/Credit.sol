pragma solidity ^0.6.4;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

import "../../module-manager/PrizePoolModuleManager.sol";
import "../../base/TokenModule.sol";
import "../../Constants.sol";

// solium-disable security/no-block-members
contract Credit is TokenModule {

  function hashName() public view override returns (bytes32) {
    return Constants.CREDIT_INTERFACE_HASH;
  }

  function mint(
    address _user,
    uint256 _collateral
  ) external onlyInterestTracker {
    _mint(_user, _collateral, "", "");
  }

  modifier onlyInterestTracker() {
    require(_msgSender() == address(PrizePoolModuleManager(address(manager)).interestTracker()), "only interest tracker");
    _;
  }
}
