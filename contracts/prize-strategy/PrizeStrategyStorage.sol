pragma solidity 0.6.4;

import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/pooltogether-rng-contracts/contracts/RNGInterface.sol";

import "../comptroller/ComptrollerInterface.sol";
import "../utils/MappedSinglyLinkedList.sol";
import "../token/TokenControllerInterface.sol";
import "../token/ControlledToken.sol";
import "../prize-pool/PrizePool.sol";
import "../Constants.sol";

contract PrizeStrategyStorage {
  struct Credit {
    uint192 balance;
    uint32 timestamp;
    bool initialized;
  }

  struct RngRequest {
    uint32 id;
    uint32 lockBlock;
  }

  // Contract Interfaces
  PrizePool public prizePool;
  ComptrollerInterface public comptroller;
  IERC20 public ticket;
  IERC20 public sponsorship;
  RNGInterface public rng;

  // Current RNG Request
  RngRequest internal rngRequest;

  // EOA credit balances on collateral supplied to pool
  mapping(address => Credit) internal creditBalances;

  // EOA mapping for ticket-weighted odds
  SortitionSumTreeFactory.SortitionSumTrees internal sortitionSumTrees;

  // Prize period
  uint256 public prizePeriodSeconds;
  uint256 public prizePeriodStartedAt;

  // Credit rate & Exit fee
  uint256 public exitFeeMantissa;
  uint256 public creditRateMantissa;

  // External tokens awarded as part of prize
  MappedSinglyLinkedList.Mapping internal externalErc20s;
  MappedSinglyLinkedList.Mapping internal externalErc721s;

  // External NFT token IDs to be awarded
  //   NFT Address => TokenIds
  mapping (address => uint256[]) internal externalErc721TokenIds;
}
