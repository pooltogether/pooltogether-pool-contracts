// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/SafeCastUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/introspection/ERC165CheckerUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@pooltogether/pooltogether-rng-contracts/contracts/RNGInterface.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "../token/TokenListener.sol";
import "../token/TokenControllerInterface.sol";
import "../token/ControlledToken.sol";
import "../token/TicketInterface.sol";
import "../prize-pool/PrizePool.sol";
import "../Constants.sol";
import "./PeriodicPrizeStrategyListenerInterface.sol";
import "./PeriodicPrizeStrategyListenerLibrary.sol";
import "./BeforeAwardListener.sol";

/* solium-disable security/no-block-members */
abstract contract PeriodicPrizeStrategy is Initializable,
                                           OwnableUpgradeable,
                                           TokenListener {

  using SafeMathUpgradeable for uint256;
  using SafeCastUpgradeable for uint256;
  using SafeERC20Upgradeable for IERC20Upgradeable;
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;
  using AddressUpgradeable for address;
  using ERC165CheckerUpgradeable for address;

  uint256 internal constant ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA = 13.4 ether;

  event PrizePoolOpened(
    address indexed operator,
    uint256 indexed prizePeriodStartedAt
  );

  event RngRequestFailed();

  event PrizePoolAwardStarted(
    address indexed operator,
    address indexed prizePool,
    uint32 indexed rngRequestId,
    uint32 rngLockBlock
  );

  event PrizePoolAwardCancelled(
    address indexed operator,
    address indexed prizePool,
    uint32 indexed rngRequestId,
    uint32 rngLockBlock
  );

  event PrizePoolAwarded(
    address indexed operator,
    uint256 randomNumber
  );

  event RngServiceUpdated(
    RNGInterface indexed rngService
  );

  event TokenListenerUpdated(
    TokenListenerInterface indexed tokenListener
  );

  event RngRequestTimeoutSet(
    uint32 rngRequestTimeout
  );

  event PrizePeriodSecondsUpdated(
    uint256 prizePeriodSeconds
  );

  event BeforeAwardListenerSet(
    BeforeAwardListenerInterface indexed beforeAwardListener
  );

  event PeriodicPrizeStrategyListenerSet(
    PeriodicPrizeStrategyListenerInterface indexed periodicPrizeStrategyListener
  );

  event ExternalErc721AwardAdded(
    IERC721Upgradeable indexed externalErc721,
    uint256[] tokenIds
  );

  event ExternalErc20AwardAdded(
    IERC20Upgradeable indexed externalErc20
  );

  event ExternalErc721AwardRemoved(
    IERC721Upgradeable indexed externalErc721Award
  );

  event ExternalErc20AwardRemoved(
    IERC20Upgradeable indexed externalErc20Award
  );

  event Initialized(
    uint256 prizePeriodStart,
    uint256 prizePeriodSeconds,
    PrizePool indexed prizePool,
    TicketInterface ticket,
    IERC20Upgradeable sponsorship,
    RNGInterface rng,
    IERC20Upgradeable[] externalErc20Awards
  );

  struct RngRequest {
    uint32 id;
    uint32 lockBlock;
    uint32 requestedAt;
  }

  // Comptroller
  TokenListenerInterface public tokenListener;

  // Contract Interfaces
  PrizePool public prizePool;
  TicketInterface public ticket;
  IERC20Upgradeable public sponsorship;
  RNGInterface public rng;

  // Current RNG Request
  RngRequest internal rngRequest;

  /// @notice RNG Request Timeout.  In fact, this is really a "complete award" timeout.
  /// If the rng completes the award can still be cancelled.
  uint32 public rngRequestTimeout;

  // Prize period
  uint256 public prizePeriodSeconds;
  uint256 public prizePeriodStartedAt;

  // External tokens awarded as part of prize
  MappedSinglyLinkedList.Mapping internal externalErc20s;
  MappedSinglyLinkedList.Mapping internal externalErc721s;

  // External NFT token IDs to be awarded
  //   NFT Address => TokenIds
  mapping (IERC721Upgradeable => uint256[]) internal externalErc721TokenIds;

  /// @notice A listener that is called before the prize is awarded
  BeforeAwardListenerInterface public beforeAwardListener;

  /// @notice A listener that is called after the prize is awarded
  PeriodicPrizeStrategyListenerInterface public periodicPrizeStrategyListener;

  /// @notice Initializes a new strategy
  /// @param _prizePeriodStart The starting timestamp of the prize period.
  /// @param _prizePeriodSeconds The duration of the prize period in seconds
  /// @param _prizePool The prize pool to award
  /// @param _ticket The ticket to use to draw winners
  /// @param _sponsorship The sponsorship token
  /// @param _rng The RNG service to use
  function initialize (
    uint256 _prizePeriodStart,
    uint256 _prizePeriodSeconds,
    PrizePool _prizePool,
    TicketInterface _ticket,
    IERC20Upgradeable _sponsorship,
    RNGInterface _rng,
    IERC20Upgradeable[] memory externalErc20Awards
  ) public initializer {
    require(address(_prizePool) != address(0), "PeriodicPrizeStrategy/prize-pool-not-zero");
    require(address(_ticket) != address(0), "PeriodicPrizeStrategy/ticket-not-zero");
    require(address(_sponsorship) != address(0), "PeriodicPrizeStrategy/sponsorship-not-zero");
    require(address(_rng) != address(0), "PeriodicPrizeStrategy/rng-not-zero");
    prizePool = _prizePool;
    ticket = _ticket;
    rng = _rng;
    sponsorship = _sponsorship;
    _setPrizePeriodSeconds(_prizePeriodSeconds);

    __Ownable_init();
    Constants.REGISTRY.setInterfaceImplementer(address(this), Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));

    externalErc20s.initialize();
    for (uint256 i = 0; i < externalErc20Awards.length; i++) {
      _addExternalErc20Award(externalErc20Awards[i]);
    }

    prizePeriodSeconds = _prizePeriodSeconds;
    prizePeriodStartedAt = _prizePeriodStart;

    externalErc721s.initialize();

    // 30 min timeout
    _setRngRequestTimeout(1800);

    emit Initialized(
      _prizePeriodStart,
      _prizePeriodSeconds,
      _prizePool,
      _ticket,
      _sponsorship,
      _rng,
      externalErc20Awards
    );
    emit PrizePoolOpened(_msgSender(), prizePeriodStartedAt);
  }

  function _distribute(uint256 randomNumber) internal virtual;

  /// @notice Calculates and returns the currently accrued prize
  /// @return The current prize size
  function currentPrize() public view returns (uint256) {
    return prizePool.awardBalance();
  }

  /// @notice Allows the owner to set the token listener
  /// @param _tokenListener A contract that implements the token listener interface.
  function setTokenListener(TokenListenerInterface _tokenListener) external onlyOwner requireAwardNotInProgress {
    require(address(0) == address(_tokenListener) || address(_tokenListener).supportsInterface(TokenListenerLibrary.ERC165_INTERFACE_ID_TOKEN_LISTENER), "PeriodicPrizeStrategy/token-listener-invalid");

    tokenListener = _tokenListener;

    emit TokenListenerUpdated(tokenListener);
  }

  /// @notice Estimates the remaining blocks until the prize given a number of seconds per block
  /// @param secondsPerBlockMantissa The number of seconds per block to use for the calculation.  Should be a fixed point 18 number like Ether.
  /// @return The estimated number of blocks remaining until the prize can be awarded.
  function estimateRemainingBlocksToPrize(uint256 secondsPerBlockMantissa) public view returns (uint256) {
    return FixedPoint.divideUintByMantissa(
      _prizePeriodRemainingSeconds(),
      secondsPerBlockMantissa
    );
  }

  /// @notice Returns the number of seconds remaining until the prize can be awarded.
  /// @return The number of seconds remaining until the prize can be awarded.
  function prizePeriodRemainingSeconds() external view returns (uint256) {
    return _prizePeriodRemainingSeconds();
  }

  /// @notice Returns the number of seconds remaining until the prize can be awarded.
  /// @return The number of seconds remaining until the prize can be awarded.
  function _prizePeriodRemainingSeconds() internal view returns (uint256) {
    uint256 endAt = _prizePeriodEndAt();
    uint256 time = _currentTime();
    if (time > endAt) {
      return 0;
    }
    return endAt.sub(time);
  }

  /// @notice Returns whether the prize period is over
  /// @return True if the prize period is over, false otherwise
  function isPrizePeriodOver() external view returns (bool) {
    return _isPrizePeriodOver();
  }

  /// @notice Returns whether the prize period is over
  /// @return True if the prize period is over, false otherwise
  function _isPrizePeriodOver() internal view returns (bool) {
    return _currentTime() >= _prizePeriodEndAt();
  }

  /// @notice Awards collateral as tickets to a user
  /// @param user The user to whom the tickets are minted
  /// @param amount The amount of interest to mint as tickets.
  function _awardTickets(address user, uint256 amount) internal {
    prizePool.award(user, amount, address(ticket));
  }

  /// @notice Awards all external tokens with non-zero balances to the given user.  The external tokens must be held by the PrizePool contract.
  /// @param winner The user to transfer the tokens to
  function _awardAllExternalTokens(address winner) internal {
    _awardExternalErc20s(winner);
    _awardExternalErc721s(winner);
  }

  /// @notice Awards all external ERC20 tokens with non-zero balances to the given user.
  /// The external tokens must be held by the PrizePool contract.
  /// @param winner The user to transfer the tokens to
  function _awardExternalErc20s(address winner) internal {
    address currentToken = externalErc20s.start();
    while (currentToken != address(0) && currentToken != externalErc20s.end()) {
      uint256 balance = IERC20Upgradeable(currentToken).balanceOf(address(prizePool));
      if (balance > 0) {
        prizePool.awardExternalERC20(winner, currentToken, balance);
      }
      currentToken = externalErc20s.next(currentToken);
    }
  }

  /// @notice Awards all external ERC721 tokens to the given user.
  /// The external tokens must be held by the PrizePool contract.
  /// @dev The list of ERC721s is reset after every award
  /// @param winner The user to transfer the tokens to
  function _awardExternalErc721s(address winner) internal {
    address currentToken = externalErc721s.start();
    while (currentToken != address(0) && currentToken != externalErc721s.end()) {
      uint256 balance = IERC721Upgradeable(currentToken).balanceOf(address(prizePool));
      if (balance > 0) {
        prizePool.awardExternalERC721(winner, currentToken, externalErc721TokenIds[IERC721Upgradeable(currentToken)]);
        _removeExternalErc721AwardTokens(IERC721Upgradeable(currentToken));
      }
      currentToken = externalErc721s.next(currentToken);
    }
    externalErc721s.clearAll();
  }

  /// @notice Returns the timestamp at which the prize period ends
  /// @return The timestamp at which the prize period ends.
  function prizePeriodEndAt() external view returns (uint256) {
    // current prize started at is non-inclusive, so add one
    return _prizePeriodEndAt();
  }

  /// @notice Returns the timestamp at which the prize period ends
  /// @return The timestamp at which the prize period ends.
  function _prizePeriodEndAt() internal view returns (uint256) {
    // current prize started at is non-inclusive, so add one
    return prizePeriodStartedAt.add(prizePeriodSeconds);
  }

  /// @notice Called by the PrizePool for transfers of controlled tokens
  /// @dev Note that this is only for *transfers*, not mints or burns
  /// @param controlledToken The type of collateral that is being sent
  function beforeTokenTransfer(address from, address to, uint256 amount, address controlledToken) external override onlyPrizePool {
    require(from != to, "PeriodicPrizeStrategy/transfer-to-self");

    if (controlledToken == address(ticket)) {
      _requireAwardNotInProgress();
    }

    if (address(tokenListener) != address(0)) {
      tokenListener.beforeTokenTransfer(from, to, amount, controlledToken);
    }
  }

  /// @notice Called by the PrizePool when minting controlled tokens
  /// @param controlledToken The type of collateral that is being minted
  function beforeTokenMint(
    address to,
    uint256 amount,
    address controlledToken,
    address referrer
  )
    external
    override
    onlyPrizePool
  {
    if (controlledToken == address(ticket)) {
      _requireAwardNotInProgress();
    }
    if (address(tokenListener) != address(0)) {
      tokenListener.beforeTokenMint(to, amount, controlledToken, referrer);
    }
  }

  /// @notice returns the current time.  Used for testing.
  /// @return The current time (block.timestamp)
  function _currentTime() internal virtual view returns (uint256) {
    return block.timestamp;
  }

  /// @notice returns the current time.  Used for testing.
  /// @return The current time (block.timestamp)
  function _currentBlock() internal virtual view returns (uint256) {
    return block.number;
  }

  /// @notice Starts the award process by starting random number request.  The prize period must have ended.
  /// @dev The RNG-Request-Fee is expected to be held within this contract before calling this function
  function startAward() external requireCanStartAward {
    (address feeToken, uint256 requestFee) = rng.getRequestFee();
    if (feeToken != address(0) && requestFee > 0) {
      IERC20Upgradeable(feeToken).approve(address(rng), requestFee);
    }

    (uint32 requestId, uint32 lockBlock) = rng.requestRandomNumber();
    rngRequest.id = requestId;
    rngRequest.lockBlock = lockBlock;
    rngRequest.requestedAt = _currentTime().toUint32();

    emit PrizePoolAwardStarted(_msgSender(), address(prizePool), requestId, lockBlock);
  }

  /// @notice Can be called by anyone to unlock the tickets if the RNG has timed out.
  function cancelAward() public {
    require(isRngTimedOut(), "PeriodicPrizeStrategy/rng-not-timedout");
    uint32 requestId = rngRequest.id;
    uint32 lockBlock = rngRequest.lockBlock;
    delete rngRequest;
    emit RngRequestFailed();
    emit PrizePoolAwardCancelled(msg.sender, address(prizePool), requestId, lockBlock);
  }

  /// @notice Completes the award process and awards the winners.  The random number must have been requested and is now available.
  function completeAward() external requireCanCompleteAward {
    uint256 randomNumber = rng.randomNumber(rngRequest.id);
    delete rngRequest;

    if (address(beforeAwardListener) != address(0)) {
      beforeAwardListener.beforePrizePoolAwarded(randomNumber, prizePeriodStartedAt);
    }
    _distribute(randomNumber);
    if (address(periodicPrizeStrategyListener) != address(0)) {
      periodicPrizeStrategyListener.afterPrizePoolAwarded(randomNumber, prizePeriodStartedAt);
    }

    // to avoid clock drift, we should calculate the start time based on the previous period start time.
    prizePeriodStartedAt = _calculateNextPrizePeriodStartTime(_currentTime());

    emit PrizePoolAwarded(_msgSender(), randomNumber);
    emit PrizePoolOpened(_msgSender(), prizePeriodStartedAt);
  }

  /// @notice Allows the owner to set a listener that is triggered immediately before the award is distributed
  /// @dev The listener must implement ERC165 and the BeforeAwardListenerInterface
  /// @param _beforeAwardListener The address of the listener contract
  function setBeforeAwardListener(BeforeAwardListenerInterface _beforeAwardListener) external onlyOwner requireAwardNotInProgress {
    require(
      address(0) == address(_beforeAwardListener) || address(_beforeAwardListener).supportsInterface(BeforeAwardListenerLibrary.ERC165_INTERFACE_ID_BEFORE_AWARD_LISTENER),
      "PeriodicPrizeStrategy/beforeAwardListener-invalid"
    );

    beforeAwardListener = _beforeAwardListener;

    emit BeforeAwardListenerSet(_beforeAwardListener);
  }

  /// @notice Allows the owner to set a listener for prize strategy callbacks.
  /// @param _periodicPrizeStrategyListener The address of the listener contract
  function setPeriodicPrizeStrategyListener(PeriodicPrizeStrategyListenerInterface _periodicPrizeStrategyListener) external onlyOwner requireAwardNotInProgress {
    require(
      address(0) == address(_periodicPrizeStrategyListener) || address(_periodicPrizeStrategyListener).supportsInterface(PeriodicPrizeStrategyListenerLibrary.ERC165_INTERFACE_ID_PERIODIC_PRIZE_STRATEGY_LISTENER),
      "PeriodicPrizeStrategy/prizeStrategyListener-invalid"
    );

    periodicPrizeStrategyListener = _periodicPrizeStrategyListener;

    emit PeriodicPrizeStrategyListenerSet(_periodicPrizeStrategyListener);
  }

  function _calculateNextPrizePeriodStartTime(uint256 currentTime) internal view returns (uint256) {
    uint256 elapsedPeriods = currentTime.sub(prizePeriodStartedAt).div(prizePeriodSeconds);
    return prizePeriodStartedAt.add(elapsedPeriods.mul(prizePeriodSeconds));
  }

  /// @notice Calculates when the next prize period will start
  /// @param currentTime The timestamp to use as the current time
  /// @return The timestamp at which the next prize period would start
  function calculateNextPrizePeriodStartTime(uint256 currentTime) external view returns (uint256) {
    return _calculateNextPrizePeriodStartTime(currentTime);
  }

  /// @notice Returns whether an award process can be started
  /// @return True if an award can be started, false otherwise.
  function canStartAward() external view returns (bool) {
    return _isPrizePeriodOver() && !isRngRequested();
  }

  /// @notice Returns whether an award process can be completed
  /// @return True if an award can be completed, false otherwise.
  function canCompleteAward() external view returns (bool) {
    return isRngRequested() && isRngCompleted();
  }

  /// @notice Returns whether a random number has been requested
  /// @return True if a random number has been requested, false otherwise.
  function isRngRequested() public view returns (bool) {
    return rngRequest.id != 0;
  }

  /// @notice Returns whether the random number request has completed.
  /// @return True if a random number request has completed, false otherwise.
  function isRngCompleted() public view returns (bool) {
    return rng.isRequestComplete(rngRequest.id);
  }

  /// @notice Returns the block number that the current RNG request has been locked to
  /// @return The block number that the RNG request is locked to
  function getLastRngLockBlock() external view returns (uint32) {
    return rngRequest.lockBlock;
  }

  /// @notice Returns the current RNG Request ID
  /// @return The current Request ID
  function getLastRngRequestId() external view returns (uint32) {
    return rngRequest.id;
  }

  /// @notice Sets the RNG service that the Prize Strategy is connected to
  /// @param rngService The address of the new RNG service interface
  function setRngService(RNGInterface rngService) external onlyOwner requireAwardNotInProgress {
    require(!isRngRequested(), "PeriodicPrizeStrategy/rng-in-flight");

    rng = rngService;
    emit RngServiceUpdated(rngService);
  }

  /// @notice Allows the owner to set the RNG request timeout in seconds.  This is the time that must elapsed before the RNG request can be cancelled and the pool unlocked.
  /// @param _rngRequestTimeout The RNG request timeout in seconds.
  function setRngRequestTimeout(uint32 _rngRequestTimeout) external onlyOwner requireAwardNotInProgress {
    _setRngRequestTimeout(_rngRequestTimeout);
  }

  /// @notice Sets the RNG request timeout in seconds.  This is the time that must elapsed before the RNG request can be cancelled and the pool unlocked.
  /// @param _rngRequestTimeout The RNG request timeout in seconds.
  function _setRngRequestTimeout(uint32 _rngRequestTimeout) internal {
    require(_rngRequestTimeout > 60, "PeriodicPrizeStrategy/rng-timeout-gt-60-secs");
    rngRequestTimeout = _rngRequestTimeout;
    emit RngRequestTimeoutSet(rngRequestTimeout);
  }

  /// @notice Allows the owner to set the prize period in seconds.
  /// @param _prizePeriodSeconds The new prize period in seconds.  Must be greater than zero.
  function setPrizePeriodSeconds(uint256 _prizePeriodSeconds) external onlyOwner requireAwardNotInProgress {
    _setPrizePeriodSeconds(_prizePeriodSeconds);
  }

  /// @notice Sets the prize period in seconds.
  /// @param _prizePeriodSeconds The new prize period in seconds.  Must be greater than zero.
  function _setPrizePeriodSeconds(uint256 _prizePeriodSeconds) internal {
    require(_prizePeriodSeconds > 0, "PeriodicPrizeStrategy/prize-period-greater-than-zero");
    prizePeriodSeconds = _prizePeriodSeconds;

    emit PrizePeriodSecondsUpdated(prizePeriodSeconds);
  }

  /// @notice Gets the current list of External ERC20 tokens that will be awarded with the current prize
  /// @return An array of External ERC20 token addresses
  function getExternalErc20Awards() external view returns (address[] memory) {
    return externalErc20s.addressArray();
  }

  /// @notice Adds an external ERC20 token type as an additional prize that can be awarded
  /// @dev Only the Prize-Strategy owner/creator can assign external tokens,
  /// and they must be approved by the Prize-Pool
  /// @param _externalErc20 The address of an ERC20 token to be awarded
  function addExternalErc20Award(IERC20Upgradeable _externalErc20) external onlyOwnerOrListener requireAwardNotInProgress {
    _addExternalErc20Award(_externalErc20);
  }

  function _addExternalErc20Award(IERC20Upgradeable _externalErc20) internal {
    require(address(_externalErc20).isContract(), "PeriodicPrizeStrategy/erc20-null");
    require(prizePool.canAwardExternal(address(_externalErc20)), "PeriodicPrizeStrategy/cannot-award-external");
    (bool succeeded, bytes memory returnValue) = address(_externalErc20).staticcall(abi.encodeWithSignature("totalSupply()"));
    require(succeeded, "PeriodicPrizeStrategy/erc20-invalid");
    externalErc20s.addAddress(address(_externalErc20));
    emit ExternalErc20AwardAdded(_externalErc20);
  }

  function addExternalErc20Awards(IERC20Upgradeable[] calldata _externalErc20s) external onlyOwnerOrListener requireAwardNotInProgress {
    for (uint256 i = 0; i < _externalErc20s.length; i++) {
      _addExternalErc20Award(_externalErc20s[i]);
    }
  }

  /// @notice Removes an external ERC20 token type as an additional prize that can be awarded
  /// @dev Only the Prize-Strategy owner/creator can remove external tokens
  /// @param _externalErc20 The address of an ERC20 token to be removed
  /// @param _prevExternalErc20 The address of the previous ERC20 token in the `externalErc20s` list.
  /// If the ERC20 is the first address, then the previous address is the SENTINEL address: 0x0000000000000000000000000000000000000001
  function removeExternalErc20Award(IERC20Upgradeable _externalErc20, IERC20Upgradeable _prevExternalErc20) external onlyOwner requireAwardNotInProgress {
    externalErc20s.removeAddress(address(_prevExternalErc20), address(_externalErc20));
    emit ExternalErc20AwardRemoved(_externalErc20);
  }

  /// @notice Gets the current list of External ERC721 tokens that will be awarded with the current prize
  /// @return An array of External ERC721 token addresses
  function getExternalErc721Awards() external view returns (address[] memory) {
    return externalErc721s.addressArray();
  }

  /// @notice Gets the current list of External ERC721 tokens that will be awarded with the current prize
  /// @return An array of External ERC721 token addresses
  function getExternalErc721AwardTokenIds(IERC721Upgradeable _externalErc721) external view returns (uint256[] memory) {
    return externalErc721TokenIds[_externalErc721];
  }

  /// @notice Adds an external ERC721 token as an additional prize that can be awarded
  /// @dev Only the Prize-Strategy owner/creator can assign external tokens,
  /// and they must be approved by the Prize-Pool
  /// NOTE: The NFT must already be owned by the Prize-Pool
  /// @param _externalErc721 The address of an ERC721 token to be awarded
  /// @param _tokenIds An array of token IDs of the ERC721 to be awarded
  function addExternalErc721Award(IERC721Upgradeable _externalErc721, uint256[] calldata _tokenIds) external onlyOwnerOrListener requireAwardNotInProgress {
    require(prizePool.canAwardExternal(address(_externalErc721)), "PeriodicPrizeStrategy/cannot-award-external");
    require(address(_externalErc721).supportsInterface(Constants.ERC165_INTERFACE_ID_ERC721), "PeriodicPrizeStrategy/erc721-invalid");
    
    if (!externalErc721s.contains(address(_externalErc721))) {
      externalErc721s.addAddress(address(_externalErc721));
    }

    for (uint256 i = 0; i < _tokenIds.length; i++) {
      _addExternalErc721Award(_externalErc721, _tokenIds[i]);
    }

    emit ExternalErc721AwardAdded(_externalErc721, _tokenIds);
  }

  function _addExternalErc721Award(IERC721Upgradeable _externalErc721, uint256 _tokenId) internal {
    require(IERC721Upgradeable(_externalErc721).ownerOf(_tokenId) == address(prizePool), "PeriodicPrizeStrategy/unavailable-token");
    for (uint256 i = 0; i < externalErc721TokenIds[_externalErc721].length; i++) {
      if (externalErc721TokenIds[_externalErc721][i] == _tokenId) {
        revert("PeriodicPrizeStrategy/erc721-duplicate");
      }
    }
    externalErc721TokenIds[_externalErc721].push(_tokenId);
  }

  /// @notice Removes an external ERC721 token as an additional prize that can be awarded
  /// @dev Only the Prize-Strategy owner/creator can remove external tokens
  /// @param _externalErc721 The address of an ERC721 token to be removed
  /// @param _prevExternalErc721 The address of the previous ERC721 token in the list.
  /// If no previous, then pass the SENTINEL address: 0x0000000000000000000000000000000000000001
  function removeExternalErc721Award(
    IERC721Upgradeable _externalErc721,
    IERC721Upgradeable _prevExternalErc721
  )
    external
    onlyOwner
    requireAwardNotInProgress
  {
    externalErc721s.removeAddress(address(_prevExternalErc721), address(_externalErc721));
    _removeExternalErc721AwardTokens(_externalErc721);
  }

  function _removeExternalErc721AwardTokens(
    IERC721Upgradeable _externalErc721
  )
    internal
  {
    delete externalErc721TokenIds[_externalErc721];
    emit ExternalErc721AwardRemoved(_externalErc721);
  }

  function _requireAwardNotInProgress() internal view {
    uint256 currentBlock = _currentBlock();
    require(rngRequest.lockBlock == 0 || currentBlock < rngRequest.lockBlock, "PeriodicPrizeStrategy/rng-in-flight");
  }

  function isRngTimedOut() public view returns (bool) {
    if (rngRequest.requestedAt == 0) {
      return false;
    } else {
      return _currentTime() > uint256(rngRequestTimeout).add(rngRequest.requestedAt);
    }
  }

  modifier onlyOwnerOrListener() {
    require(_msgSender() == owner() ||
            _msgSender() == address(periodicPrizeStrategyListener) ||
            _msgSender() == address(beforeAwardListener),
            "PeriodicPrizeStrategy/only-owner-or-listener");
    _;
  }

  modifier requireAwardNotInProgress() {
    _requireAwardNotInProgress();
    _;
  }

  modifier requireCanStartAward() {
    require(_isPrizePeriodOver(), "PeriodicPrizeStrategy/prize-period-not-over");
    require(!isRngRequested(), "PeriodicPrizeStrategy/rng-already-requested");
    _;
  }

  modifier requireCanCompleteAward() {
    require(isRngRequested(), "PeriodicPrizeStrategy/rng-not-requested");
    require(isRngCompleted(), "PeriodicPrizeStrategy/rng-not-complete");
    _;
  }

  modifier onlyPrizePool() {
    require(_msgSender() == address(prizePool), "PeriodicPrizeStrategy/only-prize-pool");
    _;
  }
}
