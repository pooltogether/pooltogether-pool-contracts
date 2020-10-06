// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.5.0 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";

import "./ReserveInterface.sol";

/// @title Interface that allows a user to draw an address using an index
contract Reserve is OwnableUpgradeSafe, ReserveInterface {

  event ReserveRecipientSet(address indexed recipient);
  event ReserveRateMantissaSet(uint256 rateMantissa);

  address public recipient;
  uint256 public rateMantissa;

  constructor () public {
    __Ownable_init();
  }

  function setRecipient(
    address _recipient
  )
    external
    onlyOwner
  {
    recipient = _recipient;

    emit ReserveRecipientSet(recipient);
  }

  function setRateMantissa(
    uint256 _rateMantissa
  )
    external
    onlyOwner
  {
    rateMantissa = _rateMantissa;

    emit ReserveRateMantissaSet(rateMantissa);
  }

  function reserveRecipient(address) external view override returns (address) {
    return recipient;
  }

  function reserveRateMantissa(address) external view override returns (uint256) {
    return rateMantissa;
  }
}
