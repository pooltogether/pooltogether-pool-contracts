pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";

contract ProtocolGovernor is Initializable, OwnableUpgradeSafe {
  uint256 public reserveFeeMantissa;
  address public reserve;

  function initialize(
    uint256 _reserveFeeMantissa,
    address _reserve
  ) public initializer {
    __Ownable_init();
    reserveFeeMantissa = _reserveFeeMantissa;
    reserve = _reserve;
  }

  function setReserveFeeMantissa(uint256 _reserveFeeMantissa) public onlyOwner {
    require(_reserveFeeMantissa < 0.1 ether, "must be less than 0.1");
    reserveFeeMantissa = _reserveFeeMantissa;
  }

  function setReserve(address _reserve) public onlyOwner {
    reserve = _reserve;
  }
}