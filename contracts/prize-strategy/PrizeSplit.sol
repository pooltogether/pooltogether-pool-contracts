// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
  * @title Abstract prize split contract for adding unique award distribution to static addresses. 
  * @author Kames Geraghty (PoolTogether Inc)
*/
abstract contract PrizeSplit is OwnableUpgradeable {
  using SafeMathUpgradeable for uint256;
  
  /* ============ Variables ============ */
  PrizeSplitConfig[] internal _prizeSplits;

  /**
    * @notice The prize split configuration struct.
    * @dev The prize split configuration struct used to award prize splits during distribution.
    * @param target Address of recipient receiving the prize split distribution
    * @param percentage Percentage of prize split with a 0-1000 range for single decimal precision i.e. 125 = 12.5%
    * @param token Token type when minting the prize split award (i.e. ticket or sponsorship)
  */
  struct PrizeSplitConfig {
      address target;
      uint16 percentage;
      uint8 token;
  }

  /* ============ Events ============ */

  /**
    * @notice Emitted when a new PrizeSplitConfig config is added.
    * @dev Emitted when a new PrizeSplitConfig config is added in setPrizeSplits or setPrizeSplit.
    * @param target Address of recipient
    * @param percentage Percentage of prize split ranging between 0 and 1000 for single decimal precision
    * @param target Token type when minting the prize split award
  */
  event PrizeSplitSet(address indexed target, uint16 percentage, uint8 token, uint256 index);

  /**
    * @notice Emitted when a PrizeSplitConfig config is removed.
    * @dev Emitted when a PrizeSplitConfig config is removed in setPrizeSplits.
    * @param target Index of a previously active prize split config
  */
  event PrizeSplitRemoved(uint256 indexed target);


  /* ============ Virtual ============ */

  /**
    * @notice Mints ticket or sponsorship tokens to prize split recipient.
    * @dev Mints ticket or sponsorship tokens to prize split recipient via the linked PrizePool contract.
    * @param target Recipient of minted tokens
    * @param amount Amount of minted tokens
    * @param tokenIndex Index (0 or 1) of a token in the prizePool.tokens mapping
  */
  function _awardPrizeSplitAmount(address target, uint256 amount, uint8 tokenIndex) virtual internal;

  /* ============ Public/External ============ */

  /**
    * @notice List of current prize splits.
    * @dev List of current prize splits set by the contract owner.
    * @return _prizeSplits Array of PrizeSplitConfig structs
  */
  function prizeSplits() external view returns (PrizeSplitConfig[] memory) {
    return _prizeSplits;
  }

  /**
    * @notice Read a prize split config by index.
    * @dev Read a PrizeSplitConfig via an active _prizeSplits index.
    * @param prizeSplitIndex The target index to read
    * @return PrizeSplitConfig A single prize split config
  */
  function prizeSplit(uint256 prizeSplitIndex) external view returns (PrizeSplitConfig memory) {
    return _prizeSplits[prizeSplitIndex];
  }

  /**
    * @notice Update, add and/or remove prize split(s) configuration.
    * @dev Update, add and/or remove prize split configs via an array of PrizeSplitConfig structs. Removes PrizeSplitConfig(s) if array lengths don't match. Limited to contract owner.
    * @param newPrizeSplits Array of PrizeSplitConfig structs
  */
  function setPrizeSplits(PrizeSplitConfig[] calldata newPrizeSplits) external onlyOwner {
    uint256 newPrizeSplitsLength = newPrizeSplits.length;

    // Add and/or update prize split configs using newPrizeSplits PrizeSplitConfig structs array.
    for (uint256 index = 0; index < newPrizeSplitsLength; index++) {
      PrizeSplitConfig memory split = newPrizeSplits[index];
      require(split.token <= 1, "MultipleWinners/invalid-prizesplit-token");
      require(split.target != address(0), "MultipleWinners/invalid-prizesplit-target");
      
      if (_prizeSplits.length <= index) {
        _prizeSplits.push(split);
      } else {
        PrizeSplitConfig memory currentSplit = _prizeSplits[index];
        if (split.target != currentSplit.target || split.percentage != currentSplit.percentage || split.token != currentSplit.token) {
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
    * @notice Updates a previously set prize split config.
    * @dev Updates a prize split config by passing a new PrizeSplitConfig struct and current index position. Limited to contract owner.
    * @param prizeStrategySplit PrizeSplitConfig config struct
    * @param prizeSplitIndex The target index to update
  */
  function setPrizeSplit(PrizeSplitConfig memory prizeStrategySplit, uint8 prizeSplitIndex) external onlyOwner {
    require(prizeSplitIndex <= _prizeSplits.length.sub(1), "MultipleWinners/nonexistent-prizesplit");
    require(prizeStrategySplit.token <= 1, "MultipleWinners/invalid-prizesplit-token");
    require(prizeStrategySplit.target != address(0), "MultipleWinners/invalid-prizesplit-target");
    
    // Update the prize split config.
    _prizeSplits[prizeSplitIndex] = prizeStrategySplit;

    // Require the current prize split percentage does not exceed 100%.
    uint256 totalPercentage = _totalPrizeSplitPercentageAmount();
    require(totalPercentage <= 1000, "MultipleWinners/invalid-prizesplit-percentage-total");

    // Emit the updated prize split configuration.
    emit PrizeSplitSet(prizeStrategySplit.target, prizeStrategySplit.percentage, prizeStrategySplit.token, prizeSplitIndex);
  }

  /* ============ Internal ============ */

  /**
  * @notice Calculate an individual PrizeSplit distribution amount.
  * @dev Calculate the PrizeSplit distribution amount using the total prize amount and individual prize split percentage.
  * @param amount The total prize award distribution amount
  * @param percentage The prize split percentage amount
  */
  function _getPrizeSplitAmount(uint256 amount, uint16 percentage) internal pure returns (uint256) {
    return (amount * percentage).div(1000);
  }

  /**
  * @notice Calculates the total prize split percentage amount using the current prize split configs. 
  * @dev Calculates the total PrizeSplitConfig percentage by adding all percentages into single variable. Used to check the total does not exceed 100% of award distribution.
  */
  function _totalPrizeSplitPercentageAmount() internal view returns (uint256) {
    uint256 _tempTotalPercentage;
    uint256 prizeSplitsLength = _prizeSplits.length;
    for (uint8 index = 0; index < prizeSplitsLength; index++) {
      PrizeSplitConfig memory split = _prizeSplits[index];
      _tempTotalPercentage = _tempTotalPercentage.add(split.percentage);
    }
    return _tempTotalPercentage;
  }

  /**
  * @notice Distributes the total prize split amount to each individual prize split config.
  * @dev Distributes the total prize split amount by looping through the _prizeSplits array and minting reward via the linked PrizeStrategy.
  * @param prize The total prize amount
  * @return The total award prize amount minus the combined prize split amounts
  */
  function _distributePrizeSplits(uint256 prize) internal returns (uint256) {
    // Store temporary total prize amount for multiple calculations using initial prize amount.
    uint256 _prizeTemp = prize;
    uint256 prizeSplitsLength = _prizeSplits.length;
    for (uint256 index = 0; index < prizeSplitsLength; index++) {
      PrizeSplitConfig memory split = _prizeSplits[index];
      uint256 _splitAmount = _getPrizeSplitAmount(_prizeTemp, split.percentage);

      // Award the prize split distribution amount.
      _awardPrizeSplitAmount(split.target, _splitAmount, split.token);

      // Update the remaining prize amount after distributing the prize split percentage.
      prize = prize.sub(_splitAmount);
    }

    return prize;
  }

}