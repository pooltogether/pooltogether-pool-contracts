// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import "../PeriodicPrizeStrategy.sol";

contract TwoWinners is PeriodicPrizeStrategy {

  function init(
    address _trustedForwarder,
    uint256 _prizePeriodStart,
    uint256 _prizePeriodSeconds,
    PrizePool _prizePool,
    address _ticket,
    address _sponsorship,
    RNGInterface _rng,
    address[] memory _externalErc20s
  ) public initializer {
    PeriodicPrizeStrategy.initialize(
      _trustedForwarder,
      _prizePeriodStart,
      _prizePeriodSeconds,
      _prizePool,
      _ticket,
      _sponsorship,
      _rng,
      _externalErc20s
    );
  }

  function _getRngRandomNumber() internal returns (uint256) {
    if (isRngTimedOut()) {
      delete rngRequest;
      emit RngRequestFailed();
    }

    (address feeToken, uint256 requestFee) = rng.getRequestFee();
    if (feeToken != address(0) && requestFee > 0) {
      IERC20(feeToken).approve(address(rng), requestFee);
    }

    (uint32 requestId, uint32 lockBlock) = rng.requestRandomNumber();
    rngRequest.id = requestId;
    rngRequest.lockBlock = lockBlock;
    rngRequest.requestedAt = _currentTime().toUint32();

    _requireRngRequestCompleted();

    uint256 rngRandomNumber = rng.randomNumber(rngRequest.id);
    delete rngRequest;

    return rngRandomNumber;
  }

  function _distribute(uint256 randomNumber) internal override {
    uint256 numberOfWinners = 2;

    uint256 prize = prizePool.captureAwardBalance();
    uint256 prizeShare = prize.div(numberOfWinners);

    uint256 totalSupply = IERC20(address(ticket)).totalSupply();
    uint256 ticketSplit = totalSupply.div(numberOfWinners);

    uint256 secondRngRandomNumber = _getRngRandomNumber();
    uint256 thirdRandomNumber = _getRngRandomNumber();

    address mainWinner = ticket.draw(randomNumber);
    address secondWinner = ticket.draw(secondRngRandomNumber);
    address thirdWinner = ticket.draw(thirdRandomNumber);

    _awardTickets(mainWinner, prizeShare);

    // Prize is only awarded to secondWinner if address is different from mainWinner
    if (keccak256(abi.encodePacked(secondWinner)) != keccak256(abi.encodePacked(mainWinner))) {
      _awardTickets(secondWinner, prizeShare);
    }

    // As a bonus, thirdWinner receives all external tokens
    _awardAllExternalTokens(thirdWinner);
  }

  function _requireRngRequestCompleted() internal view {
    require(isRngRequested(), "PeriodicPrizeStrategy/rng-not-requested");
    require(isRngCompleted(), "PeriodicPrizeStrategy/rng-not-complete");
  }
}
