// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../PeriodicPrizeStrategy.sol";

contract MultipleWinners is PeriodicPrizeStrategy {

  struct MultipleWinnersPrizeSplit {
      address target;
      uint16 percentage;
  }

  uint256 internal __numberOfWinners;
  
  MultipleWinnersPrizeSplit[2] internal _prizeSplits;

  bool public splitExternalErc20Awards;

  event SplitExternalErc20AwardsSet(bool splitExternalErc20Awards);

  event NumberOfWinnersSet(uint256 numberOfWinners);
  
  event PrizeSplitSet(address indexed target, uint16 percentage);
  
  event PrizeSplitDistributed(address indexed target, uint16 percentage, uint256 amount);

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

  function setSplitExternalErc20Awards(bool _splitExternalErc20Awards) external onlyOwner requireAwardNotInProgress {
    splitExternalErc20Awards = _splitExternalErc20Awards;

    emit SplitExternalErc20AwardsSet(splitExternalErc20Awards);
  }

  function setNumberOfWinners(uint256 count) external onlyOwner requireAwardNotInProgress {
    _setNumberOfWinners(count);
  }

  function _setNumberOfWinners(uint256 count) internal {
    require(count > 0, "MultipleWinners/winners-gte-one");

    __numberOfWinners = count;
    emit NumberOfWinnersSet(count);
  }

  function numberOfWinners() external view returns (uint256) {
    return __numberOfWinners;
  }

  function setPrizeSplit(MultipleWinnersPrizeSplit[2] memory prizeStrategySplit) external onlyOwner {
    for (uint256 index = 0; index < prizeStrategySplit.length; index++) {
        MultipleWinnersPrizeSplit memory split = prizeStrategySplit[index];

        // If MultipleWinnersPrizeSplit is non-zero address set the prize split configuation.
        if (split.target != address(0)) {
            // Split percentage must be below 1000 and greater then 0 (e.x. 200 is equal to 20% percent)
            // The range from 0 to 1000 is used for single decimal precision (e.x. 15 is 1.5%)
            require(
                split.percentage > 0 && split.percentage < 1000,
                "MultipleWinners:invalid-prizesplit-percentage-amount"
            );

            // Emit PrizeSplitSet
            PrizeSplitSet(split.target, split.percentage);

            _prizeSplits[index] = split;
        }
    }
  }

  function prizeSplits() external view returns (MultipleWinnersPrizeSplit[2] memory) {
    return _prizeSplits;
  }

  /**
  * @dev Calculate the PrizeSplit percentage
  * @param amount The prize amount
  * @param percentage The prize split percentage amount
  */
  function _getPrizeSplitPercentage(uint256 amount, uint16 percentage) internal pure returns (uint256) {
      return (amount * percentage) / 1000; // PrizeSplit percentage amount
  }

  /**
    * @dev Award prize split target with award amount
    * @param target Receiver of the prize split fee.
    * @param splitAmount Split amount to be awarded to target.
  */
  function _awardPrizeSplitAmount(address target, uint256 splitAmount) internal {
      _awardTickets(target, splitAmount);
  }

  function _distribute(uint256 randomNumber) internal override {
    uint256 prize = prizePool.captureAwardBalance();

    // Store temporary total prize amount for multiple calculations using initial prize amount.
    uint256 _prizeTemp = prize;

    // Iterate over prize splits array to calculate distribution
    for (uint256 index = 0; index < _prizeSplits.length; index++) {
        MultipleWinnersPrizeSplit memory split = _prizeSplits[index];

        // The prize split address should be a valid target address.
        if (split.target != address(0)) {
            // Calculate the split amount using the prize amount and split percentage.
            uint256 _splitAmount =
                _getPrizeSplitPercentage(_prizeTemp, split.percentage);

            // Award the PrizeSplit amount to split target
            _awardPrizeSplitAmount(split.target, _splitAmount);

            // Emit PrizeSplitDistributed
            PrizeSplitDistributed(split.target, split.percentage, _splitAmount);

            // Update the remaining prize amount after distributing the prize split percentage.
            prize -= _splitAmount;
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
