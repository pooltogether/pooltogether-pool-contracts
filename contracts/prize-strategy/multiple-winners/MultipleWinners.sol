// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../PrizeSplit.sol";
import "../PeriodicPrizeStrategy.sol";

contract MultipleWinners is PeriodicPrizeStrategy, PrizeSplit {

  uint256 internal __numberOfWinners;
  
  bool public splitExternalErc20Awards;

  /**
    * @dev Emitted when splitExternalErc20Awards is toggled.
  */
  event SplitExternalErc20AwardsSet(bool splitExternalErc20Awards);

  /**
    * @dev Emitted when numberOfWinners is set/updated.
  */
  event NumberOfWinnersSet(uint256 numberOfWinners);
  
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
    * @notice Toggle external ERC20 awards for all prize winners.
    * @dev Toggle external ERC20 awards for all prize winners. If unset will distribute external ERC20 awards to main winner.
    * @param _splitExternalErc20Awards Toggle splitting external ERC20 awards.
  */
  function setSplitExternalErc20Awards(bool _splitExternalErc20Awards) external onlyOwner requireAwardNotInProgress {
    splitExternalErc20Awards = _splitExternalErc20Awards;

    emit SplitExternalErc20AwardsSet(splitExternalErc20Awards);
  }

  /**
    * @notice Sets maximum number of winners.
    * @dev Sets maximum number of winners per award distribution period.
    * @param count Number of winners.
  */
  function setNumberOfWinners(uint256 count) external onlyOwner requireAwardNotInProgress {
    _setNumberOfWinners(count);
  }

   /**
    * @dev Set the maximum number of winners. Must be greater than 0.
    * @param count Number of winners.
  */
  function _setNumberOfWinners(uint256 count) internal {
    require(count > 0, "MultipleWinners/winners-gte-one");

    __numberOfWinners = count;
    emit NumberOfWinnersSet(count);
  }

  /**
    * @notice Maximum number of winners per award distribution period
    * @dev Read maximum number of winners per award distribution period from internal __numberOfWinners variable.
    * @return __numberOfWinners The total number of winners per prize award.
  */
  function numberOfWinners() external view returns (uint256) {
    return __numberOfWinners;
  }

  /**
    * @notice Award ticket or sponsorship tokens to prize split recipient.
    * @dev Award ticket or sponsorship tokens to prize split recipient via the linked PrizePool contract.
    * @param target Recipient of minted tokens
    * @param amount Amount of minted tokens
    * @param tokenIndex Index (0 or 1) of a token in the prizePool.tokens mapping
  */
  function _awardPrizeSplitAmount(address target, uint256 amount, uint8 tokenIndex) override internal {
    _awardToken(target, amount, tokenIndex);
  }

  /**
    * @notice Distributes captured award balance to winners
    * @dev Distributes the captured award balance to the main winner and secondary winners if __numberOfWinners greater than 1.
    * @param randomNumber Random number seed used to select winners
  */
  function _distribute(uint256 randomNumber) internal override {
    uint256 prize = prizePool.captureAwardBalance();

    // distributes prize to prize splits and returns remaining award.
    prize = _distributePrizeSplits(prize);

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
