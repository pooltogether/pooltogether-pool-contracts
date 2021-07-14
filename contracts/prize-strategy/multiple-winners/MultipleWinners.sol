// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../PeriodicPrizeStrategy.sol";

contract MultipleWinners is PeriodicPrizeStrategy {

  uint256 internal __numberOfWinners;

  bool public splitExternalErc20Awards;

  mapping(address => bool) public isBlocklisted;

  bool public carryOverBlocklist;

  uint256 public blocklistRetryCount;

  event SplitExternalErc20AwardsSet(bool splitExternalErc20Awards);

  event NumberOfWinnersSet(uint256 numberOfWinners);

  event BlocklistCarrySet(bool carry);

  event BlocklistSet(address indexed user, bool blocklisted);

  event BlocklistRetryCountSet(uint256 count);

  event RetryMaxLimitReached(uint256 numberOfWinners);

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

  function setBlocklisted(address _user, bool _blocklist) external onlyOwner requireAwardNotInProgress returns (bool) {
    isBlocklisted[_user] = _blocklist;

    emit BlocklistSet(_user, _blocklist);

    return true;
  }

  function setCarryBacklist(bool _carry) external onlyOwner requireAwardNotInProgress returns (bool) {
    carryOverBlocklist = _carry;

    emit BlocklistCarrySet(_carry);

    return true;
  }

  function setBlocklistRetryCount(uint256 _count) external onlyOwner requireAwardNotInProgress returns (bool) {
    blocklistRetryCount = _count;

    emit BlocklistRetryCountSet(_count);

    return true;
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

  function _distribute(uint256 randomNumber) internal override {
    uint256 prize = prizePool.captureAwardBalance();

    if (IERC20Upgradeable(address(ticket)).totalSupply() == 0) {
      emit NoWinners();
      return;
    }

    bool _carryOverBlocklistPrizes = carryOverBlocklist;

    // main winner is simply the first that is drawn
    uint256 numberOfWinners = __numberOfWinners;
    address[] memory winners = new address[](numberOfWinners);
    uint256 nextRandom = randomNumber;
    uint256 winnerCount = 0;
    uint256 retries = 0;
    uint256 _retryCount = blocklistRetryCount;
    while (winnerCount < numberOfWinners) {
      address winner = ticket.draw(nextRandom);

      if (!isBlocklisted[winner]) {
        winners[winnerCount++] = winner;
      } else if (++retries >= _retryCount) {
        emit RetryMaxLimitReached(numberOfWinners);
        break;
      }

      // add some arbitrary numbers to the previous random number to ensure no matches with the UniformRandomNumber lib
      bytes32 nextRandomHash = keccak256(abi.encodePacked(nextRandom + 499 + winnerCount*521));
      nextRandom = uint256(nextRandomHash);
    }

    // yield prize is split up among all winners

    // main winner gets all external ERC721 tokens
    _awardExternalErc721s(winners[0]);

    uint256 prizeShare = _carryOverBlocklistPrizes ? prize.div(numberOfWinners) : prize.div(winnerCount);
    if (prizeShare > 0) {
      for (uint i = 0; i < winnerCount; i++) {
        _awardTickets(winners[i], prizeShare);
      }
    }

    if (splitExternalErc20Awards) {
      address currentToken = externalErc20s.start();
      while (currentToken != address(0) && currentToken != externalErc20s.end()) {
        uint256 balance = IERC20Upgradeable(currentToken).balanceOf(address(prizePool));
        uint256 split = _carryOverBlocklistPrizes ? balance.div(numberOfWinners) : balance.div(winnerCount);
        if (split > 0) {
          for (uint256 i = 0; i < winnerCount; i++) {
            prizePool.awardExternalERC20(winners[i], currentToken, split);
          }
        }
        currentToken = externalErc20s.next(currentToken);
      }
    } else {
      _awardExternalErc20s(winners[0]);
    }
  }
}
