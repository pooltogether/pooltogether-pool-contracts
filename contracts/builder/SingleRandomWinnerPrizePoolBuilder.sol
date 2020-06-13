pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "../prize-strategy/SingleRandomWinnerPrizeStrategyFactory.sol";
import "../ticket/TicketFactory.sol";
import "../external/compound/CTokenInterface.sol";
import "./PrizePoolBuilder.sol";

contract SingleRandomWinnerPrizePoolBuilder is Initializable {

  PrizePoolBuilder public prizePoolBuilder;
  SingleRandomWinnerPrizeStrategyFactory public prizeStrategyFactory;

  event SingleRandomWinnerPrizePoolCreated(
    address indexed creator,
    address indexed prizePool,
    address indexed singleRandomWinnerPrizeStrategy
  );

  function initialize (
    PrizePoolBuilder _prizePoolBuilder,
    SingleRandomWinnerPrizeStrategyFactory _prizeStrategyFactory
  ) public initializer {
    require(address(_prizePoolBuilder) != address(0), "prize pool builder must be defined");
    require(address(_prizeStrategyFactory) != address(0), "prize strategy factory must be defined");
    prizePoolBuilder = _prizePoolBuilder;
    prizeStrategyFactory = _prizeStrategyFactory;
  }

  function createSingleRandomWinnerPrizePool(
    CTokenInterface cToken,
    uint256 prizePeriodInSeconds,
    string calldata _ticketName,
    string calldata _ticketSymbol,
    string calldata _sponsorshipName,
    string calldata _sponsorshipSymbol
  ) external returns (SingleRandomWinnerPrizeStrategy) {

    SingleRandomWinnerPrizeStrategy prizeStrategy = prizeStrategyFactory.createSingleRandomWinner();
    prizeStrategy.initialize();

    PeriodicPrizePool prizePool = prizePoolBuilder.createPeriodicPrizePool(
      cToken,
      prizeStrategy,
      prizePeriodInSeconds,
      _ticketName,
      _ticketSymbol,
      _sponsorshipName,
      _sponsorshipSymbol
    );

    emit SingleRandomWinnerPrizePoolCreated(msg.sender, address(prizePool), address(prizeStrategy));

    return prizeStrategy;
  }
}
