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

  bytes32 private interfaceHash;

  function initialize(
    NamedModuleManager _manager,
    address _trustedForwarder,
    string memory name,
    string memory symbol,
    bytes32 _interfaceHash
  ) public initializer {
    require(_interfaceHash != bytes32(0), "interface hash must be defined");
    interfaceHash = _interfaceHash;
    super.initialize(_manager, _trustedForwarder, name, symbol);
  }

  function hashName() public view override returns (bytes32) {
    return interfaceHash;
  }

  function mint(
    address _user,
    uint256 _collateral
  ) external onlyManagerOrModule {
    _mint(_user, _collateral, "", "");
  }
}
