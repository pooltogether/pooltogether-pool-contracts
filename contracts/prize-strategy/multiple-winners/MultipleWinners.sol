// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../PeriodicPrizeStrategy.sol";

contract MultipleWinners is PeriodicPrizeStrategy {

  enum TokenType {
    Ticket,
    Sponsorship
  }

  struct MultipleWinnersPrizeSplit {
      address target;
      uint16 percentage;
      TokenType token;
  }

  uint256 internal __numberOfWinners;
  uint16 internal _totalPrizeSplitPercentage;
  
  MultipleWinnersPrizeSplit[] internal _prizeSplits;

  bool public splitExternalErc20Awards;

  /**
    * @dev Emitted when SplitExternalErc20Awards is set/toggled.
  */
  event SplitExternalErc20AwardsSet(bool splitExternalErc20Awards);

  /**
    * @dev Emitted when numberOfWinners is set/updated.
  */
  event NumberOfWinnersSet(uint256 numberOfWinners);
  
  /**
    * @dev Emitted when a new MultipleWinnersPrizeSplit config is added.
  */
  event PrizeSplitSet(address indexed target, uint16 percentage, TokenType token);

  /**
    * @dev Emitted when a MultipleWinnersPrizeSplit config is removed.
  */
  event PrizeSplitRemoved(address indexed target);
  
  /**
    * @dev Emitted is a winner is selected during the prize period award process.
  */
  event NoWinners();

  function initializeMultipleWinners (
    uint256 _prizePeriodStart,
    uint256 _prizePeriodSeconds,
    PrizePool _prizePool,
    TicketInterface _ticket,
    IERC20Upgradeable _sponsorship,
    RNGInterface _rng,
    uint256 _numberOfWinners
  ) public initializer {
    IERC20Upgradeable[] memory _externalErc20Awards;

    PeriodicPrizeStrategy.initialize(
      _prizePeriodStart,
      _prizePeriodSeconds,
      _prizePool,
      _ticket,
      _sponsorship,
      _rng,
      _externalErc20Awards
    );

    _setNumberOfWinners(_numberOfWinners);
  }

  /**
    * @notice Set if external ERC20 awards should be split
    * @dev Set if external ERC20 awards should be split amongst each winner using a bool.
    * @param _splitExternalErc20Awards Toggle splitting external ERC20 awards.
  */
  function setSplitExternalErc20Awards(bool _splitExternalErc20Awards) external onlyOwner requireAwardNotInProgress {
    splitExternalErc20Awards = _splitExternalErc20Awards;

    emit SplitExternalErc20AwardsSet(splitExternalErc20Awards);
  }

  /**
    * @notice Set the number of winners.
    * @dev Set the number of winners for each prize period.
    * @param count Number of winners.
  */
  function setNumberOfWinners(uint256 count) external onlyOwner requireAwardNotInProgress {
    _setNumberOfWinners(count);
  }

   /**
    * @dev Internal call for setNumberOfWinners
    * @param count Number of winners.
  */
  function _setNumberOfWinners(uint256 count) internal {
    require(count > 0, "MultipleWinners/winners-gte-one");

    __numberOfWinners = count;
    emit NumberOfWinnersSet(count);
  }

  /**
    * @notice Number of winners awards are distributed to upon winning.
    * @dev Number of winners awards are distributed to upon winning set by owner.
    * @return __numberOfWinners The total number of winners per prize award.
  */
  function numberOfWinners() external view returns (uint256) {
    return __numberOfWinners;
  }
  /**
    * @notice Number of winners awards are distributed to upon winning.
    * @dev Number of winners awards are distributed to upon winning set by owner.
    * @return totalPrizeSplitPercentage The total number of winners per prize award.
  */
  function totalPrizeSplitPercentage() external view returns (uint16 totalPrizeSplitPercentage) {
    return _totalPrizeSplitPercentage;
  }

  /**
    * @notice Set the prize split configration.
    * @dev Set the prize split by passing an array MultipleWinnersPrizeSplit structs.
    * @param prizeStrategySplit Array of MultipleWinnersPrizeSplit structs.
  */
  function setPrizeSplit(MultipleWinnersPrizeSplit[] memory prizeStrategySplit) external onlyOwner {
    uint256 _tempTotalPercentage;

    for (uint256 index = 0; index < prizeStrategySplit.length; index++) {
        MultipleWinnersPrizeSplit memory split = prizeStrategySplit[index];

        // If MultipleWinnersPrizeSplit is non-zero address set the prize split configuation.
        if (split.target != address(0)) {
            // Split percentage must be below 1000 and greater then 0 (e.x. 200 is equal to 20% percent)
            // The range from 0 to 1000 is used for single decimal precision (e.x. 15 is 1.5%)
            require(split.percentage > 0 && split.percentage <= 1000, "MultipleWinners/invalid-prizesplit-percentage-amount");
            require(uint8(split.token) < 2, "MultipleWinners/invalid-ticket-type");

            _tempTotalPercentage = _tempTotalPercentage.add(split.percentage);

            emit PrizeSplitSet(split.target, split.percentage, split.token);

            _prizeSplits.push(split);
        }
    }

    // The total of all prize splits can NOT exceed 100% of the awarded prize amount.
    require(_tempTotalPercentage <= 1000, "MultipleWinners/invalid-prizesplit-percentage-total");

    // Store the total prize split percentage. Used when adding a single prize split config.
    _totalPrizeSplitPercentage = _tempTotalPercentage.toUint16();
  }

  /**
    * @notice Remove a prize split config 
    * @dev Remove a prize split by passing the index of target prize split config.
    * @param prizeSplitIndex The target index to delete.
  */
  function removePrizeSplit(uint8 prizeSplitIndex) external onlyOwner {
    require(prizeSplitIndex <= _prizeSplits.length, "MultipleWinners/invalid-prize-split-index");

     MultipleWinnersPrizeSplit memory removedPrizeSplit = _prizeSplits[prizeSplitIndex];

    // Maintaining the order of the prizeSplits array is not required. To reduce gas costs the last
    // prize split config is saved to the index being removed and then deleted from the last array position.
    // This removes the requirement to shift each item in the array once a configration has been removed.

    // Move last prize split configuration to designated index position
    _prizeSplits[prizeSplitIndex] = _prizeSplits[_prizeSplits.length.sub(1)];

    // Delete the copied last prize split configration 
    delete _prizeSplits[_prizeSplits.length.sub(1)];

    emit PrizeSplitRemoved(removedPrizeSplit.target);
  }

  /**
    * @notice List of active prize splits
    * @dev List of active prize splits set by the prize strategy owner
    * @return _prizeSplits Array of MultipleWinnersPrizeSplit structs
  */
  function prizeSplits() external view returns (MultipleWinnersPrizeSplit[] memory _prizeSplits) {
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

  /**
    * @dev Award prize split target with award amount
    * @param target Receiver of the prize split fee.
    * @param splitAmount Ticket amount sent to target.
  */
  function _awardPrizeSplitTicketAmount(address target, uint256 splitAmount) internal {
      _awardTickets(target, splitAmount);
  }
  
  /**
    * @dev Award prize split target with sponsorship amount
    * @param target Receiver of the prize split fee.
    * @param splitAmount Sponsorship amount sent to target.
  */
  function _awardPrizeSplitSponsorshipAmount(address target, uint256 splitAmount) internal {
      _awardSponsorship(target, splitAmount);
  }

  /**
    * @dev Distrubtes the captured prize period award balance.
    * @dev Distrubtes the captured prize period award balance to the main and secondary randomly selected users.
    * @param randomNumber Receiver of the prize split fee.
  */
  function _distribute(uint256 randomNumber) internal override {
    uint256 prize = prizePool.captureAwardBalance();

    // Store temporary total prize amount for multiple calculations using initial prize amount.
    uint256 _prizeTemp = prize;

    // Check prize split exists
    if(_prizeSplits.length > 0) {
      // Iterate over prize splits array to calculate distribution
      for (uint256 index = 0; index < _prizeSplits.length; index++) {
          MultipleWinnersPrizeSplit memory split = _prizeSplits[index];

          // The prize split address should be a valid target address.
          if (split.target != address(0)) {
              // Calculate the split amount using the prize amount and split percentage.
              uint256 _splitAmount =
                  _getPrizeSplitAmount(_prizeTemp, split.percentage);

              // Award the PrizeSplit amount to split target
              if(split.token == TokenType.Ticket) {
                _awardPrizeSplitTicketAmount(split.target, _splitAmount);
              } else {
                _awardPrizeSplitSponsorshipAmount(split.target, _splitAmount);
              }

              // Update the remaining prize amount after distributing the prize split percentage.
              prize = prize.sub(_splitAmount);
          }
      }
    }

    // main winner is simply the first that is drawn
    address mainWinner = ticket.draw(randomNumber);

    // If drawing yields no winner, then there is no one to pick
    if (mainWinner == address(0)) {
      emit NoWinners();
      return;
    }

    // main winner gets all external ERC721 tokens
    _awardExternalErc721s(mainWinner);

    address[] memory winners = new address[](__numberOfWinners);
    winners[0] = mainWinner;

    uint256 nextRandom = randomNumber;
    for (uint256 winnerCount = 1; winnerCount < __numberOfWinners; winnerCount++) {
      // add some arbitrary numbers to the previous random number to ensure no matches with the UniformRandomNumber lib
      bytes32 nextRandomHash = keccak256(abi.encodePacked(nextRandom + 499 + winnerCount*521));
      nextRandom = uint256(nextRandomHash);
      winners[winnerCount] = ticket.draw(nextRandom);
    }

    // yield prize is split up among all winners
    uint256 prizeShare = prize.div(winners.length);
    if (prizeShare > 0) {
      for (uint i = 0; i < winners.length; i++) {
        _awardTickets(winners[i], prizeShare);
      }
    }

    if (splitExternalErc20Awards) {
      address currentToken = externalErc20s.start();
      while (currentToken != address(0) && currentToken != externalErc20s.end()) {
        uint256 balance = IERC20Upgradeable(currentToken).balanceOf(address(prizePool));
        uint256 split = balance.div(__numberOfWinners);
        if (split > 0) {
          for (uint256 i = 0; i < winners.length; i++) {
            prizePool.awardExternalERC20(winners[i], currentToken, split);
          }
        }
        currentToken = externalErc20s.next(currentToken);
      }
    } else {
      _awardExternalErc20s(mainWinner);
    }
  }
}
