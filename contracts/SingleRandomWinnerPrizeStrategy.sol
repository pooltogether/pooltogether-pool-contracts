pragma solidity ^0.6.4;

import "@openzeppelin/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/uniform-random-number/contracts/UniformRandomNumber.sol";

import "./PrizePool.sol";
import "./IPrizeStrategy.sol";

contract SingleRandomWinnerPrizeStrategy is IPrizeStrategy {
  using SortitionSumTreeFactory for SortitionSumTreeFactory.SortitionSumTrees;

  IERC1820Registry constant internal ERC1820_REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);

  // keccak256("ERC777TokensRecipient")
  bytes32 constant internal TOKENS_RECIPIENT_INTERFACE_HASH =
    0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b;

  bytes32 constant private TREE_KEY = keccak256("PoolTogether/SingleRandomWinnerPrizeStrategy");
  uint256 constant private MAX_TREE_LEAVES = 5;

  SortitionSumTreeFactory.SortitionSumTrees sortitionSumTrees;
  PrizePool prizePool;

  uint256 currentPrizeBlock;
  uint256 prizePeriodBlocks;

  constructor (
    PrizePool _prizePool,
    uint256 _prizePeriodBlocks
  ) public {
    require(address(_prizePool) != address(0), "prize pool must not be zero");
    require(_prizePeriodBlocks > 0, "prize period must be greater than zero");
    sortitionSumTrees.createTree(TREE_KEY, MAX_TREE_LEAVES);
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
    prizePool = _prizePool;
    prizePeriodBlocks = _prizePeriodBlocks;
    currentPrizeBlock = block.number;
  }

  function award() external onlyPrizePeriodOver {
    address winner = drawUser();
    prizePool.mintPrize(winner);
    currentPrizeBlock = block.number;
  }

  function drawUser() public view returns (address) {
    bytes32 entropy = blockhash(1);
    uint256 bound = totalSupply();
    address selected;
    if (bound == 0) {
      selected = address(0);
    } else {
      uint256 token = UniformRandomNumber.uniform(uint256(entropy), bound);
      selected = address(uint256(sortitionSumTrees.draw(TREE_KEY, token)));
    }
    return selected;
  }

  function totalSupply() public view returns (uint256) {
    return sortitionSumTrees.total(TREE_KEY);
  }

  function chanceOf(address user) public view returns (uint256) {
    return sortitionSumTrees.stakeOf(TREE_KEY, bytes32(uint256(user)));
  }

  function afterBalanceChanged(address user, uint256 amount) external override {
    sortitionSumTrees.set(TREE_KEY, amount, bytes32(uint256(user)));
  }

  function prizePeriodEnd() public view returns (uint256) {
    return currentPrizeBlock + prizePeriodBlocks;
  }

  modifier onlyPrizePeriodOver() {
    require(block.number > prizePeriodEnd(), "prize period not over");
    _;
  }
}