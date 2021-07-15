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
  
  PrizeSplitConfig[] internal _prizeSplits;

  /**
    * @notice The prize split configuration struct.
    * @dev The prize split configuration struct used to award prize splits during distribution.
    * @param target Address of recipient receiving the prize split distribution
    * @param percentage Percentage of prize split using a 0-1000 range for single decimal precision i.e. 125 = 12.5%
    * @param token Position of controlled token in prizePool.tokens (i.e. ticket or sponsorship)
  */
  struct PrizeSplitConfig {
      address target;
      uint16 percentage;
      uint8 token;
  }

  /**
    * @notice Emitted when a PrizeSplitConfig config is added or updated.
    * @dev Emitted when aPrizeSplitConfig config is added or updated in setPrizeSplits or setPrizeSplit.
    * @param target Address of prize split recipient
    * @param percentage Percentage of prize split. Must be between 0 and 1000 for single decimal precision
    * @param token Index (0 or 1) of token in the prizePool.tokens mapping
    * @param index Index of prize split in the prizeSplts array
  */
  event PrizeSplitSet(address indexed target, uint16 percentage, uint8 token, uint256 index);

  /**
    * @notice Emitted when a PrizeSplitConfig config is removed.
    * @dev Emitted when a PrizeSplitConfig config is removed from the _prizeSplits array.
    * @param target Index of a previously active prize split config
  */
  event PrizeSplitRemoved(uint256 indexed target);

  /**
    * @notice Mints ticket or sponsorship tokens to prize split recipient.
    * @dev Mints ticket or sponsorship tokens to prize split recipient via the linked PrizePool contract.
    * @param target Recipient of minted tokens
    * @param amount Amount of minted tokens
    * @param tokenIndex Index (0 or 1) of a token in the prizePool.tokens mapping
  */
  function _awardPrizeSplitAmount(address target, uint256 amount, uint8 tokenIndex) virtual internal;

  /**
    * @notice Read all prize splits configs.
    * @dev Read all PrizeSplitConfig structs stored in _prizeSplits.
    * @return _prizeSplits Array of PrizeSplitConfig structs
  */
  function prizeSplits() external view returns (PrizeSplitConfig[] memory) {
    return _prizeSplits;
  }

  /**
    * @notice Read prize split config from active PrizeSplits.
    * @dev Read PrizeSplitConfig struct from _prizeSplits array.
    * @param prizeSplitIndex Index position of PrizeSplitConfig
    * @return PrizeSplitConfig Single prize split config
  */
  function prizeSplit(uint256 prizeSplitIndex) external view returns (PrizeSplitConfig memory) {
    return _prizeSplits[prizeSplitIndex];
  }

  /**
    * @notice Set and remove prize split(s) configs.
    * @dev Set and remove prize split configs by passing a new PrizeSplitConfig structs array. Will remove existing PrizeSplitConfig(s) if passed array length is less than existing _prizeSplits length.
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

    // Remove old prize splits configs. Match storage _prizesSplits.length with the passed newPrizeSplits.length
    while (_prizeSplits.length > newPrizeSplitsLength) {
      uint256 _index = _prizeSplits.length.sub(1);
      _prizeSplits.pop();
      emit PrizeSplitRemoved(_index);
    }

    // Total prize split do not exceed 100%
    uint256 totalPercentage = _totalPrizeSplitPercentageAmount();
    require(totalPercentage <= 1000, "MultipleWinners/invalid-prizesplit-percentage-total");
  }

  /**
    * @notice Updates a previously set prize split config.
    * @dev Updates a prize split config by passing a new PrizeSplitConfig struct and current index position. Limited to contract owner.
    * @param prizeStrategySplit PrizeSplitConfig config struct
    * @param prizeSplitIndex Index position of PrizeSplitConfig to update
  */
  function setPrizeSplit(PrizeSplitConfig memory prizeStrategySplit, uint8 prizeSplitIndex) external onlyOwner {
    require(prizeSplitIndex < _prizeSplits.length, "MultipleWinners/nonexistent-prizesplit");
    require(prizeStrategySplit.token <= 1, "MultipleWinners/invalid-prizesplit-token");
    require(prizeStrategySplit.target != address(0), "MultipleWinners/invalid-prizesplit-target");
    
    // Update the prize split config
    _prizeSplits[prizeSplitIndex] = prizeStrategySplit;

    // Total prize split do not exceed 100%
    uint256 totalPercentage = _totalPrizeSplitPercentageAmount();
    require(totalPercentage <= 1000, "MultipleWinners/invalid-prizesplit-percentage-total");

    // Emit updated prize split config
    emit PrizeSplitSet(prizeStrategySplit.target, prizeStrategySplit.percentage, prizeStrategySplit.token, prizeSplitIndex);
  }

  /**
  * @notice Calculate single prize split distribution amount.
  * @dev Calculate single prize split distribution amount using the total prize amount and prize split percentage.
  * @param amount Total prize award distribution amount
  * @param percentage Percentage with single decimal precision using 0-1000 ranges
  */
  function _getPrizeSplitAmount(uint256 amount, uint16 percentage) internal pure returns (uint256) {
    return (amount * percentage).div(1000);
  }

  /**
  * @notice Calculates total prize split percentage amount.
  * @dev Calculates total PrizeSplitConfig percentage(s) amount. Used to check the total does not exceed 100% of award distribution.
  * @return Total prize split(s) percentage amount
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
  * @notice Distributes prize split(s).
  * @dev Distributes prize split(s) by awarding ticket or sponsorship tokens.
  * @param prize Starting prize award amount
  * @return Total prize award distribution amount exlcuding the awarded prize split(s)
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