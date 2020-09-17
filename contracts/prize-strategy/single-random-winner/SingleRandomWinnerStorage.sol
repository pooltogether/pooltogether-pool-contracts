// SPDX-License-Identifier: GPL-3.0-only

pragma solidity >=0.6.0 <0.7.0;

import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/pooltogether-rng-contracts/contracts/RNGInterface.sol";

import "../../comptroller/ComptrollerInterface.sol";
import "../../utils/MappedSinglyLinkedList.sol";
import "../../token/TokenControllerInterface.sol";
import "../../token/ControlledToken.sol";
import "../../token/TicketInterface.sol";
import "../../prize-pool/PrizePool.sol";
import "../../Constants.sol";

contract SingleRandomWinnerStorage {
  struct RngRequest {
    uint32 id;
    uint32 lockBlock;
    uint32 requestedAt;
  }

  // Contract Interfaces
  PrizePool public prizePool;
  TicketInterface public ticket;
  IERC20 public sponsorship;
  RNGInterface public rng;

  // Current RNG Request
  RngRequest internal rngRequest;

  // RNG Request Timeout
  uint32 public rngRequestTimeout;

  // Prize period
  uint256 public prizePeriodSeconds;
  uint256 public prizePeriodStartedAt;

  // External tokens awarded as part of prize
  MappedSinglyLinkedList.Mapping internal externalErc20s;
  MappedSinglyLinkedList.Mapping internal externalErc721s;

  // External NFT token IDs to be awarded
  //   NFT Address => TokenIds
  mapping (address => uint256[]) internal externalErc721TokenIds;
}
