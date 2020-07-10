pragma solidity ^0.6.4;

import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/governor-contracts/contracts/GovernorInterface.sol";

import "../prize-pool/MappedSinglyLinkedList.sol";
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

  mapping(address => CreditBalance) internal creditBalances;

  PrizePool public prizePool;
  GovernorInterface public governor;
  IERC20 public ticket;
  IERC20 public sponsorship;
  SortitionSumTreeFactory.SortitionSumTrees internal sortitionSumTrees;

  uint256 public prizePeriodSeconds;
  uint256 public prizePeriodStartedAt;

  uint256 public previousPrize;
  uint256 public previousPrizeAverageTickets;

  uint256 public prizeAverageTickets;

  RNGInterface public rng;
  uint256 public rngRequestId;

  // external tokens awarded as part of prize
  MappedSinglyLinkedList.Mapping internal externalAwardMapping;
}
