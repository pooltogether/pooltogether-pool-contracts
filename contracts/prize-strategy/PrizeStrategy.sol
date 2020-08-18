pragma solidity 0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "./PrizeStrategyStorage.sol";
import "./PrizeStrategyInterface.sol";
import "../token/TokenControllerInterface.sol";
import "../token/ControlledToken.sol";
import "../prize-pool/PrizePool.sol";
import "../Constants.sol";
import "../utils/RelayRecipient.sol";

/* solium-disable security/no-block-members */
contract PrizeStrategy is PrizeStrategyStorage,
                          Initializable,
                          OwnableUpgradeSafe,
                          RelayRecipient,
                          ReentrancyGuardUpgradeSafe,
                          PrizeStrategyInterface {

  using SafeMath for uint256;
  using SafeCast for uint256;
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;

  uint256 internal constant ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA = 13.4 ether;

  event PrizePoolOpened(
    address indexed operator,
    uint256 indexed prizePeriodStartedAt
  );

  event PrizePoolAwardStarted(
    address indexed operator,
    address indexed prizePool,
    uint32 indexed rngRequestId,
    uint32 rngLockBlock
  );

  event PrizePoolAwarded(
    address indexed operator,
    uint256 randomNumber,
    uint256 prize,
    uint256 reserveFee
  );

  event RngServiceUpdated(
    address rngService
  );

  function initialize (
    address _trustedForwarder,
    ComptrollerInterface _comptroller,
    uint256 _prizePeriodStart,
    uint256 _prizePeriodSeconds,
    PrizePool _prizePool,
    address _ticket,
    address _sponsorship,
    RNGInterface _rng,
    address[] memory _externalErc20s
  ) public initializer {
    require(address(_comptroller) != address(0), "PrizeStrategy/comptroller-not-zero");
    require(_prizePeriodSeconds > 0, "PrizeStrategy/prize-period-greater-than-zero");
    require(address(_prizePool) != address(0), "PrizeStrategy/prize-pool-not-zero");
    require(address(_ticket) != address(0), "PrizeStrategy/ticket-not-zero");
    require(address(_sponsorship) != address(0), "PrizeStrategy/sponsorship-not-zero");
    require(address(_rng) != address(0), "PrizeStrategy/rng-not-zero");
    prizePool = _prizePool;
    ticket = TicketInterface(_ticket);
    rng = _rng;
    sponsorship = IERC20(_sponsorship);
    trustedForwarder = _trustedForwarder;

    __Ownable_init();
    __ReentrancyGuard_init();
    comptroller = _comptroller;
    Constants.REGISTRY.setInterfaceImplementer(address(this), Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));

    for (uint256 i = 0; i < _externalErc20s.length; i++) {
      require(prizePool.canAwardExternal(_externalErc20s[i]), "PrizeStrategy/cannot-award-external");
    }
    externalErc20s.initialize();
    externalErc20s.addAddresses(_externalErc20s);

    prizePeriodSeconds = _prizePeriodSeconds;
    prizePeriodStartedAt = _prizePeriodStart;

    externalErc721s.initialize();

    emit PrizePoolOpened(_msgSender(), prizePeriodStartedAt);
  }

  /// @notice Calculates and returns the currently accrued prize
  /// @return The current prize size
  function currentPrize() public returns (uint256) {
    uint256 balance = prizePool.awardBalance();
    uint256 reserveFee = _calculateReserveFee(balance);
    return balance.sub(reserveFee);
  }

  /// @notice Calculates the reserve portion of the given amount of funds.  If there is no reserve address, the portion will be zero.
  /// @param amount The prize amount
  /// @return The size of the reserve portion of the prize
  function _calculateReserveFee(uint256 amount) internal view returns (uint256) {
    uint256 reserveRateMantissa = comptroller.reserveRateMantissa();
    if (reserveRateMantissa == 0) {
      return 0;
    }
    return FixedPoint.multiplyUintByMantissa(amount, reserveRateMantissa);
  }

  /// @notice Estimates the prize size using the default ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA
  /// @return The estimated final size of the prize
  function estimatePrize() public returns (uint256) {
    return estimatePrizeWithBlockTime(ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA);
  }

  /// @notice Estimates the prize size given the passed number of seconds per block
  /// @param secondsPerBlockMantissa The seconds per block to use for the calculation. Should be a fixed point 18 number like Ether.
  /// @return The estimated final size of the prize.
  function estimatePrizeWithBlockTime(uint256 secondsPerBlockMantissa) public returns (uint256) {
    return currentPrize().add(estimateRemainingPrizeWithBlockTime(secondsPerBlockMantissa));
  }

  /// @notice Estimates the size of the *remaining* prize to accrue.
  /// This function uses the constant ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA to calculate the accrued interest.
  /// @return The estimated remaining prize
  function estimateRemainingPrize() public view returns (uint256) {
    return estimateRemainingPrizeWithBlockTime(ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA);
  }

  /// @notice Estimates the size of the *remaining* prize to accrue.  Allows the user to pass the seconds per block value.
  /// @param secondsPerBlockMantissa The seconds per block to use for the calculation.  Should be a fixed point 18 number like Ether.
  /// @return The estimated remaining prize
  function estimateRemainingPrizeWithBlockTime(uint256 secondsPerBlockMantissa) public view returns (uint256) {
    uint256 remaining = prizePool.estimateAccruedInterestOverBlocks(
      prizePool.accountedBalance(),
      estimateRemainingBlocksToPrize(secondsPerBlockMantissa)
    );
    uint256 reserveFee = _calculateReserveFee(remaining);
    return remaining.sub(reserveFee);
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
  function prizePeriodRemainingSeconds() public view returns (uint256) {
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

  /// @notice Awards the given amount of collateral to a user as sponsorship.
  /// @param user The user to award
  /// @param amount The amount of sponsorship to award
  function _awardSponsorship(address user, uint256 amount) internal {
    prizePool.award(user, amount, address(sponsorship));
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
      uint256 balance = IERC20(currentToken).balanceOf(address(prizePool));
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
      uint256 balance = IERC721(currentToken).balanceOf(address(prizePool));
      if (balance > 0) {
        prizePool.awardExternalERC721(winner, currentToken, externalErc721TokenIds[currentToken]);
        delete externalErc721TokenIds[currentToken];
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
  /// @param from The user whose tokens are being transferred
  /// @param to The user who is receiving the tokens.
  /// @param amount The amount of tokens being sent.
  /// @param controlledToken The type of collateral that is being sent
  function beforeTokenTransfer(address from, address to, uint256 amount, address controlledToken) external override onlyPrizePool {
    if (controlledToken == address(ticket)) {
      _requireNotLocked();
    }
  }

  /// @notice Called by the prize pool after a deposit has been made.
  /// @param to The user who deposited collateral
  /// @param amount The amount of collateral they deposited
  /// @param controlledToken The type of collateral they deposited
  function afterDepositTo(
    address to,
    uint256 amount,
    address controlledToken,
    bytes calldata data
  )
    external
    override
    onlyPrizePool
    requireNotLocked
  {
    _afterDepositTo(to, amount, controlledToken, data);
  }

  /// @notice Called by the prize pool after a deposit has been made.
  /// @param to The user who deposited collateral
  /// @param amount The amount of collateral they deposited
  /// @param controlledToken The type of collateral they deposited
  function afterTimelockDepositTo(
    address,
    address to,
    uint256 amount,
    address controlledToken,
    bytes calldata
  )
    external
    override
    onlyPrizePool
    requireNotLocked
  {
    _afterDepositTo(to, amount, controlledToken, "");
  }

  /// @notice Called by the prize pool after a deposit has been made.
  /// @param to The user who deposited collateral
  /// @param amount The amount of collateral they deposited
  /// @param controlledToken The type of collateral they deposited
  function _afterDepositTo(address to, uint256 amount, address controlledToken, bytes memory data) internal {
    uint256 balance = IERC20(controlledToken).balanceOf(to);
    uint256 totalSupply = IERC20(controlledToken).totalSupply();

    address referrer;
    if (data.length > 0) {
      (address ref) = abi.decode(data, (address));
      referrer = ref;
    }

    comptroller.afterDepositTo(to, amount, balance, totalSupply, controlledToken, referrer);
  }

  /// @notice Called by the prize pool after a withdrawal with timelock has been made.
  /// @param from The user who withdrew
  /// @param controlledToken The type of collateral that was withdrawn
  function afterWithdrawWithTimelockFrom(
    address from,
    uint256 amount,
    address controlledToken,
    bytes calldata
  )
    external
    override
    onlyPrizePool
    requireNotLocked
  {
    uint256 balance = IERC20(controlledToken).balanceOf(from);
    comptroller.afterWithdrawFrom(from, amount, balance, IERC20(controlledToken).totalSupply(), controlledToken);
  }

  /// @notice Called by the prize pool after a user withdraws collateral instantly
  /// @param from the user who withdrew
  /// @param controlledToken The type of collateral they withdrew
  function afterWithdrawInstantlyFrom(
    address,
    address from,
    uint256 amount,
    address controlledToken,
    uint256,
    bytes calldata
  )
    external
    override
    onlyPrizePool
    requireNotLocked
  {
    uint256 balance = IERC20(controlledToken).balanceOf(from);
    comptroller.afterWithdrawFrom(from, amount, balance, IERC20(controlledToken).totalSupply(), controlledToken);
  }

  /// @notice Called by the prize pool after a timelocked withdrawal has been swept
  /// @param operator The user who swept the funds
  /// @param from The user whose funds are being swept
  /// @param amount The amount of funds swept.
  function afterSweepTimelockedWithdrawal(address operator, address from, uint256 amount) external override {
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
      IERC20(feeToken).approve(address(rng), requestFee);
    }

    (uint32 requestId, uint32 lockBlock) = rng.requestRandomNumber();
    rngRequest.id = requestId;
    rngRequest.lockBlock = lockBlock;

    emit PrizePoolAwardStarted(_msgSender(), address(prizePool), requestId, lockBlock);
  }

  /// @notice Completes the award process and awards the winners.  The random number must have been requested and is now available.
  function completeAward() external requireCanCompleteAward {
    uint256 randomNumber = rng.randomNumber(rngRequest.id);
    uint256 balance = prizePool.awardBalance();
    uint256 reserveFee = _calculateReserveFee(balance);
    uint256 prize = balance.sub(reserveFee);

    delete rngRequest;

    if (reserveFee > 0) {
      _awardSponsorship(address(comptroller), reserveFee);
    }

    address winner = ticket.draw(randomNumber);
    if (winner != address(0)) {
      _awardTickets(winner, prize);
      _awardAllExternalTokens(winner);
    }

    // to avoid clock drift, we should calculate the start time based on the previous period start time.
    prizePeriodStartedAt = _calculateNextPrizePeriodStartTime(_currentTime());

    emit PrizePoolAwarded(_msgSender(), randomNumber, prize, reserveFee);
    emit PrizePoolOpened(_msgSender(), prizePeriodStartedAt);
  }

  function _calculateNextPrizePeriodStartTime(uint256 currentTime) internal view returns (uint256) {
    uint256 elapsedPeriods = currentTime.sub(prizePeriodStartedAt).div(prizePeriodSeconds);
    return prizePeriodStartedAt.add(elapsedPeriods.mul(prizePeriodSeconds));
  }

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
  function getLastRngLockBlock() public view returns (uint32) {
    return rngRequest.lockBlock;
  }

  /// @notice Returns the current RNG Request ID
  /// @return The current Request ID
  function getLastRngRequestId() public view returns (uint32) {
    return rngRequest.id;
  }

  /// @notice Sets the RNG service that the Prize Strategy is connected to
  /// @param rngService The address of the new RNG service interface
  function setRngService(RNGInterface rngService) external onlyOwner {
    require(!isRngRequested(), "PrizeStrategy/rng-in-flight");

    rng = rngService;
    emit RngServiceUpdated(address(rngService));
  }

  /// @notice Adds an external ERC20 token type as an additional prize that can be awarded
  /// @dev Only the Prize-Strategy owner/creator can assign external tokens,
  /// and they must be approved by the Prize-Pool
  /// @param _externalErc20 The address of an ERC20 token to be awarded
  function addExternalErc20Award(address _externalErc20) external onlyOwner {
    require(prizePool.canAwardExternal(_externalErc20), "PrizeStrategy/cannot-award-external");
    externalErc20s.addAddress(_externalErc20);
  }

  /// @notice Adds an external ERC721 token as an additional prize that can be awarded
  /// @dev Only the Prize-Strategy owner/creator can assign external tokens,
  /// and they must be approved by the Prize-Pool
  /// NOTE: The NFT must already be owned by the Prize-Pool
  /// @param _externalErc721 The address of an ERC721 token to be awarded
  /// @param _tokenIds An array of token IDs of the ERC721 to be awarded
  function addExternalErc721Award(address _externalErc721, uint256[] calldata _tokenIds) external onlyOwner {
    require(prizePool.canAwardExternal(_externalErc721), "PrizeStrategy/cannot-award-external");
    externalErc721s.addAddress(_externalErc721);

    for (uint256 i = 0; i < _tokenIds.length; i++) {
      uint256 tokenId = _tokenIds[i];
      require(IERC721(_externalErc721).ownerOf(tokenId) == address(prizePool), "PrizeStrategy/unavailable-token");
      externalErc721TokenIds[_externalErc721].push(tokenId);
    }
  }

  function _requireNotLocked() internal view {
    require(rngRequest.lockBlock == 0 || _currentBlock() < rngRequest.lockBlock, "PrizeStrategy/rng-in-flight");
  }

  modifier requireNotLocked() {
    _requireNotLocked();
    _;
  }

  modifier requireCanStartAward() {
    require(_isPrizePeriodOver(), "PrizeStrategy/prize-period-not-over");
    require(!isRngRequested(), "PrizeStrategy/rng-already-requested");
    _;
  }

  modifier requireCanCompleteAward() {
    require(_isPrizePeriodOver(), "PrizeStrategy/prize-period-not-over");
    require(isRngRequested(), "PrizeStrategy/rng-not-requested");
    require(isRngCompleted(), "PrizeStrategy/rng-not-complete");
    _;
  }

  modifier onlyPrizePool() {
    require(_msgSender() == address(prizePool), "PrizeStrategy/only-prize-pool");
    _;
  }

  function _msgSender() internal override(BaseRelayRecipient, ContextUpgradeSafe) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }

}
