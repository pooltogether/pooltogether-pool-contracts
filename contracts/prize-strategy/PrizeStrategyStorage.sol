pragma solidity ^0.6.4;

import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/governor-contracts/contracts/GovernorInterface.sol";
import "@pooltogether/pooltogether-rng-contracts/contracts/RNGInterface.sol";

import "../prize-pool/MappedSinglyLinkedList.sol";
import "../token/TokenControllerInterface.sol";
import "../token/ControlledToken.sol";
import "../prize-pool/PrizePool.sol";
import "../Constants.sol";

contract PrizeStrategyStorage {
  struct Credit {
    uint192 balance;
    uint64 timestamp;
  }

  mapping(address => Credit) internal creditBalances;

  PrizePool public prizePool;
  GovernorInterface public governor;
  IERC20 public ticket;
  IERC20 public sponsorship;
  RNGInterface public rng;

  SortitionSumTreeFactory.SortitionSumTrees internal sortitionSumTrees;

  struct RngRequest {
    uint32 id;
    uint32 lockBlock;
  }

  uint256 public prizePeriodSeconds;
  uint256 public prizePeriodStartedAt;

  RngRequest internal rngRequest;

  // external tokens awarded as part of prize
  MappedSinglyLinkedList.Mapping internal externalAwardMapping;

  uint256 public exitFeeMantissa;

  uint256 public creditRateMantissa;
}
