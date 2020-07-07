pragma solidity ^0.6.4;

import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/governor-contracts/contracts/GovernorInterface.sol";

import "../token/TokenControllerInterface.sol";
import "../token/ControlledToken.sol";
import "../prize-pool/PrizePool.sol";
import "../rng/RNGInterface.sol";
import "../Constants.sol";

contract PrizeStrategyStorage {

  struct CreditBalance {
    uint128 interestIndex;
    uint128 credit;
  }

  mapping(address => CreditBalance) creditBalances;

  PrizePool public prizePool;
  GovernorInterface public governor;
  ControlledToken public ticket;
  ControlledToken public sponsorship;
  SortitionSumTreeFactory.SortitionSumTrees sortitionSumTrees;

  uint256 public prizePeriodSeconds;
  uint256 public prizePeriodStartedAt;

  uint256 internal previousPrize;
  uint256 internal previousPrizeAverageTickets;

  uint256 internal prizeAverageTickets;

  RNGInterface public rng;
  uint256 public rngRequestId;

}
