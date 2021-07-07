// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract PrizeSplit is OwnableUpgradeable {
  using SafeMathUpgradeable for uint256;

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
  event PrizeSplitSet(address indexed target, uint16 percentage, TokenType token, uint256 index);

  /**
    * @dev Emitted when a MultipleWinnersPrizeSplit config is removed.
  */
  event PrizeSplitRemoved(uint256 indexed index);


  /**
    * @notice Award ticket to prize split target
    * @dev Award ticket to prize split target using prize strategy function
    * @param target Address of recipient.
    * @param amount Amount to receive.
    * @param tokenType The token type.
  */
  function _awardPrizeSplitAmount(address target, uint256 amount, uint256 tokenType) virtual internal;

  /**
    * @notice Set the prize split(s) configration.
    * @dev Set the prize split(s) by passing an array of MultipleWinnersPrizeSplit structs.
    * @param newPrizeSplits Array of MultipleWinnersPrizeSplit structs.
  */
  function setPrizeSplits(MultipleWinnersPrizeSplit[] memory newPrizeSplits) external onlyOwner {
    uint256 newPrizeSplitsLength = newPrizeSplits.length;

    // Add and/or update prize split configs using newPrizeSplits MultipleWinnersPrizeSplit structs array.
    for (uint256 index = 0; index < newPrizeSplitsLength; index++) {
      MultipleWinnersPrizeSplit memory split = newPrizeSplits[index];
      require(split.target != address(0), "MultipleWinners/invalid-prizesplit-target");
      
      if(_prizeSplits.length <= index) {
        _prizeSplits.push(split);
      } else {
        MultipleWinnersPrizeSplit memory currentSplit = _prizeSplits[index];
        if(split.target != currentSplit.target || split.percentage != currentSplit.percentage || split.token != currentSplit.token) {
          _prizeSplits[index] = split;
        } else {
          continue;
        }
      }

      // Emit the added/updated prize split config.
      emit PrizeSplitSet(split.target, split.percentage, split.token, index);
    }

    // Remove prize splits by comparing the current _prizesSplits with the passed prizeSplits
    while (_prizeSplits.length > newPrizeSplitsLength) {
      uint256 _index = _prizeSplits.length.sub(1);
      _prizeSplits.pop();
      emit PrizeSplitRemoved(_index);
    }

     // Require the current prize split percentage does not exceed 100%.
    uint256 totalPercentage = _totalPrizeSplitPercentageAmount();
    require(totalPercentage <= 1000, "MultipleWinners/invalid-prizesplit-percentage-total");
  }

  /**
    * @notice Update a prize split config.
    * @dev Update a prize split config by passing a MultipleWinnersPrizeSplit struct and index position.
    * @param prizeStrategySplit MultipleWinnersPrizeSplit config struct.
    * @param prizeSplitIndex The target index to update.
  */
  function setPrizeSplit(MultipleWinnersPrizeSplit memory prizeStrategySplit, uint8 prizeSplitIndex) external onlyOwner {
    require(prizeSplitIndex <= _prizeSplits.length.sub(1), "MultipleWinners/nonexistent-prizesplit");
    require(prizeStrategySplit.target != address(0), "MultipleWinners/invalid-prizesplit-target");
    
    // Update the prize split config.
    _prizeSplits[prizeSplitIndex] = prizeStrategySplit;

    // Require the current prize split percentage does not exceed 100%.
    uint256 totalPercentage = _totalPrizeSplitPercentageAmount();
    require(totalPercentage <= 1000, "MultipleWinners/invalid-prizesplit-percentage-total");

    // Emit the updated prize split configuration.
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
    * @notice Read a prize split config by index
    * @dev Read a prize split MultipleWinnersPrizeSplit config by passing a _prizeSplits index
    * @param prizeSplitIndex The target index to read
    * @return MultipleWinnersPrizeSplit A single prize split config
  */
  function prizeSplit(uint256 prizeSplitIndex) external view returns (MultipleWinnersPrizeSplit memory) {
    return _prizeSplits[prizeSplitIndex];
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

  /**
  * @notice Require the prize split percentage amount does not exceed 100%.
  * @dev Require the prize split percentage amount does not exceed 100% with the current prize splits.
  */
  function _totalPrizeSplitPercentageAmount() internal view returns (uint256) {
    uint256 _tempTotalPercentage;
    for (uint8 index = 0; index < _prizeSplits.length; index++) {
      MultipleWinnersPrizeSplit memory split = _prizeSplits[index];
      _tempTotalPercentage = _tempTotalPercentage.add(split.percentage);
    }
    return _tempTotalPercentage;
  }

  function _distributePrizeSplits(uint256 prize) internal returns (uint256) {
    // Store temporary total prize amount for multiple calculations using initial prize amount.
    uint256 _prizeTemp = prize;

    for (uint256 index = 0; index < _prizeSplits.length; index++) {
      MultipleWinnersPrizeSplit memory split = _prizeSplits[index];
      uint256 _splitAmount = _getPrizeSplitAmount(_prizeTemp, split.percentage);

      // Award the prize split distribution amount.
      _awardPrizeSplitAmount(split.target, _splitAmount, split.token);

      // Update the remaining prize amount after distributing the prize split percentage.
      prize = prize.sub(_splitAmount);
    }

    return prize;
  }

}