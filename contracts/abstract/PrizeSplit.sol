// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/SafeCastUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract PrizeSplit is OwnableUpgradeable {
  using SafeMathUpgradeable for uint256;
  using SafeCastUpgradeable for uint256;

  enum TokenType {
    Ticket,
    Sponsorship
  }

  struct MultipleWinnersPrizeSplit {
      address target;
      uint16 percentage;
      TokenType token;
  }

  MultipleWinnersPrizeSplit[] internal _prizeSplits;

  /**
    * @dev Emitted when a new MultipleWinnersPrizeSplit config is added.
  */
  event PrizeSplitSet(address indexed target, uint16 percentage, TokenType token, uint8 index);

  /**
    * @dev Emitted when a MultipleWinnersPrizeSplit config is removed.
  */
  event PrizeSplitRemoved(address indexed target, uint8 index);


  /**
    * @notice Award ticket to prize split target
    * @dev Award ticket to prize split target using prize strategy function
    * @param target Address of recipient.
    * @param amount Amount to receive.
  */
  function _awardPrizeSplitTicketAmount(address target, uint256 amount) virtual internal;
  
  /**
    * @notice Award sponsorship to prize split target
    * @dev Award sponsorship to prize split target using prize strategy function
    * @param target Address of recipient.
    * @param amount Amount to receive.
  */
  function _awardPrizeSplitSponsorshipAmount(address target, uint256 amount) virtual internal;

  /**
    * @notice Set the prize split configration.
    * @dev Set the prize split by passing an array MultipleWinnersPrizeSplit structs.
    * @param prizeStrategySplit Array of MultipleWinnersPrizeSplit structs.
  */
  function setPrizeSplits(MultipleWinnersPrizeSplit[] memory prizeStrategySplit) external onlyOwner {
    uint256 _tempTotalPercentage;

    for (uint8 index = 0; index < prizeStrategySplit.length; index++) {
        MultipleWinnersPrizeSplit memory split = prizeStrategySplit[index];

        require(uint8(split.token) < 2, "MultipleWinners/invalid-prizesplit-token");
        require(split.target != address(0), "MultipleWinners/invalid-prizesplit-target");
        // Split percentage must be below 1000 and greater then 0 (e.x. 200 is equal to 20% percent)
        // The range from 0 to 1000 is used for single decimal precision (e.x. 15 is 1.5%)
        require(split.percentage > 0 && split.percentage <= 1000, "MultipleWinners/invalid-prizesplit-percentage");

        if(_prizeSplits.length <= index) {
          _prizeSplits.push(split);
        } else {
          _prizeSplits[index] = split;
        }

      emit PrizeSplitSet(split.target, split.percentage, split.token, index);

      _tempTotalPercentage = _tempTotalPercentage.add(split.percentage);
    }

    // If updating remove outdated prize split configurations not passed in the new prizeStrategySplit 
    while (_prizeSplits.length > prizeStrategySplit.length) {
      uint8 _index = _prizeSplits.length.sub(1).toUint8();
      MultipleWinnersPrizeSplit memory _split = _prizeSplits[_index];
      delete _prizeSplits[_index];
      _prizeSplits.pop();
      emit PrizeSplitRemoved(_split.target, _index);
    }

    // The total of all prize splits can NOT exceed 100% of the awarded prize amount.
    require(_tempTotalPercentage <= 1000, "MultipleWinners/invalid-prizesplit-percentage-total");
  }

   /**
    * @notice Remove a prize split config 
    * @dev Remove a prize split by passing the index of target prize split config.
    * @param prizeSplitIndex The target index to delete.
  */
  function setPrizeSplit(MultipleWinnersPrizeSplit memory prizeStrategySplit, uint8 prizeSplitIndex) external onlyOwner {
    require(prizeStrategySplit.target != address(0), "MultipleWinners/invalid-prizesplit-target");
    require(prizeStrategySplit.percentage > 0 && prizeStrategySplit.percentage <= 1000, "MultipleWinners/invalid-prizesplit-percentage-amount");

    if(prizeSplitIndex > _prizeSplits.length.sub(1)) {
      // Add a new prize split config to _prizeSplits array.
      _prizeSplits.push(prizeStrategySplit);
    } else {
      // Update prize split config to _prizeSplits array.
      _prizeSplits[prizeSplitIndex] = prizeStrategySplit;
    }

    // Verify the total prize splits percetnage do not exceed 100% of award.
    uint256 _tempTotalPercentage;
    for (uint256 index = 0; index < _prizeSplits.length; index++) {
      MultipleWinnersPrizeSplit memory split = _prizeSplits[index];
      _tempTotalPercentage = _tempTotalPercentage.add(split.percentage);
    }

    require(_tempTotalPercentage <= 1000, "MultipleWinners/invalid-prizesplit-percentage-total");

    emit PrizeSplitSet(prizeStrategySplit.target, prizeStrategySplit.percentage, prizeStrategySplit.token, prizeSplitIndex);
  }


  /**
    * @notice List of active prize splits
    * @dev List of active prize splits set by the prize strategy owner
    * @return _prizeSplits Array of MultipleWinnersPrizeSplit structs
  */
  function prizeSplits() external view returns (MultipleWinnersPrizeSplit[] memory) {
    return _prizeSplits;
  }

  /**
  * @dev Calculate the PrizeSplit percentage
  * @param amount The prize amount
  * @param percentage The prize split percentage amount
  */
  function _getPrizeSplitAmount(uint256 amount, uint16 percentage) internal pure returns (uint256) {
    // Total prize split amount calculated from current award and target percentage.
      return (amount * percentage).div(1000);
  }

  function _distributePrizeSplits(uint256 prize) internal returns (uint256) {
    // Store temporary total prize amount for multiple calculations using initial prize amount.
    uint256 _prizeTemp = prize;

    for (uint256 index = 0; index < _prizeSplits.length; index++) {
      MultipleWinnersPrizeSplit memory split = _prizeSplits[index];
      uint256 _splitAmount = _getPrizeSplitAmount(_prizeTemp, split.percentage);

      if(split.token == TokenType.Ticket) {
        _awardPrizeSplitTicketAmount(split.target, _splitAmount);
      } else {
        _awardPrizeSplitSponsorshipAmount(split.target, _splitAmount);
      }

      // Update the remaining prize amount after distributing the prize split percentage.
      prize = prize.sub(_splitAmount);
    }

    return prize;
  }

}