// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "./BeforeAwardListener.sol";
import "../external/sablier/ISablier.sol";
import "./PeriodicPrizeStrategy.sol";

/// @title Manages Sablier streams for Prize Pools.  Can be attached to Periodic Prize Strategies so that streams are withdrawn before awarding.
contract SablierManager is BeforeAwardListener {

  /// @dev Emitted when a new Sablier stream is created for a prize pool
  event SablierStreamCreated(uint256 indexed streamId, address indexed prizePool);

  /// @dev Emitted when a stream is withdrawn for a prize pool
  event SablierStreamWithdrawn(uint256 indexed streamId, uint256 balance);

  /// @dev Emitted when the stream is cancelled for a prize pool
  event SablierStreamCancelled(uint256 indexed streamId);

  /// @notice The address of the Sablier monolithic contract
  ISablier public sablier;

  mapping(address => uint256) internal sablierStreamIds;

  /// @param _sablier The address of the Sablier contract
  constructor(ISablier _sablier) public {
    require(address(_sablier) != address(0), "SablierManager/sablier-undefined");
    sablier = _sablier;
  }

  /// @notice Allows the Prize Pool owner to create a new Sablier stream for the prize pool.  If there is an existing stream it will be cancelled.
  /// @param prizePool The Prize Pool for which to stream tokens to
  /// @param deposit The amount of tokens to deposit into the stream
  /// @param token The token that is being deposited
  /// @param startTime The time at which the stream starts.  Must be in the future.
  /// @param stopTime The time at which the stream ends.  Must be later than the start time.
  /// @return The id of the newly created stream
  function createSablierStream(
    OwnableUpgradeable prizePool,
    uint256 deposit,
    IERC20Upgradeable token,
    uint256 startTime,
    uint256 stopTime
  ) external onlyPrizePoolOwner(prizePool) returns (uint256) {
    cancelSablierStream(prizePool);
    IERC20Upgradeable(token).transferFrom(msg.sender, address(this), deposit);
    IERC20Upgradeable(token).approve(address(sablier), deposit);
    uint256 sablierStreamId = sablier.createStream(address(prizePool), deposit, address(token), startTime, stopTime);
    sablierStreamIds[address(prizePool)] = sablierStreamId;

    emit SablierStreamCreated(sablierStreamId, address(prizePool));

    return sablierStreamId;
  }

  /// @notice Allows the owner of a prize pool to cancel the sablier stream for the pool
  /// @param prizePool The prize pool whose stream should be cancelled.
  function cancelSablierStream(OwnableUpgradeable prizePool) public onlyPrizePoolOwner(prizePool) {
    uint256 sablierStreamId = sablierStreamIds[address(prizePool)];
    if (sablierStreamId != 0) {
      sablier.cancelStream(sablierStreamId);

      delete sablierStreamIds[address(prizePool)];

      emit SablierStreamCancelled(sablierStreamId);
    }
  }

  /// @notice Allows anyone to trigger a withdrawal for a prize pool's Sablier stream
  /// @param prizePool The prize pool whose stream should be withdrawn
  /// @return The amount that was withdrawn
  function withdrawSablierStream(address prizePool) public returns (uint256) {
    uint256 sablierStreamId = sablierStreamIds[prizePool];

    // If no sablier or stream set, then ignore
    if (sablierStreamId == 0) {
      return 0;
    }

    uint256 balance = sablier.balanceOf(sablierStreamId, prizePool);

    if (balance > 0) {
      require(sablier.withdrawFromStream(sablierStreamId, balance), "PeriodicPrizeStrategy/sablier-withdraw-failed");
    }

    emit SablierStreamWithdrawn(sablierStreamId, balance);

    return balance;
  }

  /// @notice Returns the available balance of a prize pool's stream.  This is the amount that can be currently withdrawn.
  /// @param prizePool The prize pool whose stream should be withdrawn
  /// @return The currently withdrawable balance for the prize pool stream
  function balanceOf(address prizePool) external view returns (uint256) {
    uint256 sablierStreamId = sablierStreamIds[prizePool];

    // If no sablier or stream set, then ignore
    if (sablierStreamId == 0) {
      return 0;
    }

    return sablier.balanceOf(sablierStreamId, prizePool);
  }

  /// @notice Returns the stream id for the prize pool, if any
  /// @param prizePool The prize pool whose stream id should be retrieved
  /// @return The sablier stream id for the prize pool.
  function sablierStreamId(address prizePool) external view returns (uint256) {
    return sablierStreamIds[prizePool];
  }

  /// @notice Allows a periodic prize strategy to call the manager to withdraw the stream before awarding the prize.
  function beforePrizePoolAwarded(uint256, uint256) external override {
    PeriodicPrizeStrategy prizeStrategy = PeriodicPrizeStrategy(msg.sender);
    withdrawSablierStream(address(prizeStrategy.prizePool()));
  }

  modifier onlyPrizePoolOwner(OwnableUpgradeable prizePool) {
    require(msg.sender == prizePool.owner(), "SablierManager/caller-not-owner");
    _;
  }

}
