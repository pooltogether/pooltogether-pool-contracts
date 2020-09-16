// SPDX-License-Identifier: GPL-3.0-only

pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "./SingleRandomWinnerBuilder.sol";
import "../comptroller/ComptrollerInterface.sol";
import "../prize-strategy/single-random-winner/SingleRandomWinnerProxyFactory.sol";
import "../prize-pool/compound/CompoundPrizePoolProxyFactory.sol";
import "../token/ControlledTokenProxyFactory.sol";
import "../token/TicketProxyFactory.sol";
import "../external/compound/CTokenInterface.sol";
import "../external/openzeppelin/OpenZeppelinProxyFactoryInterface.sol";

/* solium-disable security/no-block-members */
contract CompoundPrizePoolBuilder {
  using SafeMath for uint256;
  using SafeCast for uint256;

  struct CompoundPrizePoolConfig {
    CTokenInterface cToken;
    uint256 maxExitFeeMantissa;
    uint256 maxTimelockDuration;
  }

  event SingleRandomWinnerCreated (
    address indexed singleRandomWinner,
    address indexed ticket,
    address indexed sponsorship
  );

  event CompoundPrizePoolCreated (
    address indexed creator,
    address indexed prizePool,
    address indexed prizeStrategy
  );

  ComptrollerInterface public comptroller;
  CompoundPrizePoolProxyFactory public compoundPrizePoolProxyFactory;
  ControlledTokenProxyFactory public controlledTokenProxyFactory;
  TicketProxyFactory public ticketProxyFactory;
  SingleRandomWinnerProxyFactory public singleRandomWinnerProxyFactory;
  OpenZeppelinProxyFactoryInterface public proxyFactory;
  address public trustedForwarder;

  constructor (
    ComptrollerInterface _comptroller,
    SingleRandomWinnerProxyFactory _singleRandomWinnerProxyFactory,
    address _trustedForwarder,
    CompoundPrizePoolProxyFactory _compoundPrizePoolProxyFactory,
    ControlledTokenProxyFactory _controlledTokenProxyFactory,
    OpenZeppelinProxyFactoryInterface _proxyFactory,
    TicketProxyFactory _ticketProxyFactory
  ) public {
    require(address(_comptroller) != address(0), "CompoundPrizePoolBuilder/comptroller-not-zero");
    require(address(_singleRandomWinnerProxyFactory) != address(0), "CompoundPrizePoolBuilder/single-random-winner-factory-not-zero");
    require(address(_compoundPrizePoolProxyFactory) != address(0), "CompoundPrizePoolBuilder/compound-prize-pool-builder-not-zero");
    require(address(_controlledTokenProxyFactory) != address(0), "CompoundPrizePoolBuilder/controlled-token-proxy-factory-not-zero");
    require(address(_proxyFactory) != address(0), "CompoundPrizePoolBuilder/proxy-factory-not-zero");
    require(address(_ticketProxyFactory) != address(0), "CompoundPrizePoolBuilder/ticket-proxy-factory-not-zero");
    proxyFactory = _proxyFactory;
    ticketProxyFactory = _ticketProxyFactory;
    comptroller = _comptroller;
    singleRandomWinnerProxyFactory = _singleRandomWinnerProxyFactory;
    trustedForwarder = _trustedForwarder;
    compoundPrizePoolProxyFactory = _compoundPrizePoolProxyFactory;
    controlledTokenProxyFactory = _controlledTokenProxyFactory;
  }

  function createSingleRandomWinner(
    CompoundPrizePoolConfig calldata prizePoolConfig,
    SingleRandomWinnerBuilder.SingleRandomWinnerConfig calldata prizeStrategyConfig
  ) external returns (SingleRandomWinner) {

    SingleRandomWinner prizeStrategy;
    if (prizeStrategyConfig.proxyAdmin != address(0)) {
      prizeStrategy = SingleRandomWinner(
        proxyFactory.deploy(block.timestamp, address(singleRandomWinnerProxyFactory.instance()), prizeStrategyConfig.proxyAdmin, "")
      );
    } else {
      prizeStrategy = singleRandomWinnerProxyFactory.create();
    }

    CompoundPrizePool prizePool = _createCompoundPrizePool(
      prizePoolConfig,
      prizeStrategy
    );

    uint8 decimals = prizePoolConfig.cToken.decimals();

    prizePool.addControlledToken(address(
      _createTicket(
        prizePool,
        prizeStrategyConfig.ticketName,
        prizeStrategyConfig.ticketSymbol,
        decimals
      )
    ));

    prizePool.addControlledToken(address(
      _createControlledToken(
        prizePool,
        prizeStrategyConfig.sponsorshipName,
        prizeStrategyConfig.sponsorshipSymbol,
        decimals
      )
    ));

    address[] memory tokens = prizePool.tokens();

    prizePool.setCreditPlanOf(
      tokens[1],
      prizeStrategyConfig.ticketCreditRateMantissa.toUint128(),
      prizeStrategyConfig.ticketCreditLimitMantissa.toUint128()
    );

    prizePool.setReserveFeeControlledToken(tokens[0]);

    prizeStrategy.initialize(
      trustedForwarder,
      prizeStrategyConfig.prizePeriodStart,
      prizeStrategyConfig.prizePeriodSeconds,
      prizePool,
      tokens[1],
      tokens[0],
      prizeStrategyConfig.rngService,
      prizeStrategyConfig.externalERC20Awards
    );

    prizeStrategy.transferOwnership(msg.sender);
    prizePool.transferOwnership(msg.sender);

    emit SingleRandomWinnerCreated(address(prizeStrategy), tokens[1], tokens[0]);

    return prizeStrategy;
  }

  function _createCompoundPrizePool(
    CompoundPrizePoolConfig memory config,
    PrizePoolTokenListenerInterface prizeStrategy
  )
    internal
    returns (CompoundPrizePool)
  {
    CompoundPrizePool prizePool = compoundPrizePoolProxyFactory.create();

    address[] memory tokens;

    prizePool.initialize(
      trustedForwarder,
      prizeStrategy,
      comptroller,
      tokens,
      config.maxExitFeeMantissa,
      config.maxTimelockDuration,
      config.cToken
    );

    emit CompoundPrizePoolCreated(msg.sender, address(prizePool), address(prizeStrategy));

    return prizePool;
  }

  function createCompoundPrizePool(
    CompoundPrizePoolConfig calldata config,
    PrizePoolTokenListenerInterface prizeStrategy
  )
    external
    returns (CompoundPrizePool)
  {
    CompoundPrizePool prizePool = _createCompoundPrizePool(config, prizeStrategy);
    prizePool.transferOwnership(msg.sender);
    return prizePool;
  }

  function _createControlledToken(
    TokenControllerInterface controller,
    string memory name,
    string memory symbol,
    uint8 decimals
  ) internal returns (ControlledToken) {
    ControlledToken token = controlledTokenProxyFactory.create();
    token.initialize(string(name), string(symbol), decimals, trustedForwarder, controller);
    return token;
  }

  function _createTicket(
    TokenControllerInterface controller,
    string memory name,
    string memory symbol,
    uint8 decimals
  ) internal returns (Ticket) {
    Ticket ticket = ticketProxyFactory.create();
    ticket.initialize(string(name), string(symbol), decimals, trustedForwarder, controller);
    return ticket;
  }
}
