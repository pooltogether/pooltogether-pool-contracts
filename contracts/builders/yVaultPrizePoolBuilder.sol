// SPDX-License-Identifier: GPL-3.0-only

pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "../comptroller/ComptrollerInterface.sol";
import "./SingleRandomWinnerBuilder.sol";
import "../prize-strategy/single-random-winner/SingleRandomWinnerProxyFactory.sol";
import "../prize-pool/yearn/yVaultPrizePoolProxyFactory.sol";
import "../token/ControlledTokenProxyFactory.sol";
import "../token/TicketProxyFactory.sol";
import "../external/yearn/yVaultInterface.sol";
import "../external/openzeppelin/OpenZeppelinProxyFactoryInterface.sol";

/* solium-disable security/no-block-members */
contract yVaultPrizePoolBuilder {
  using SafeMath for uint256;
  using SafeCast for uint256;

  struct yVaultPrizePoolConfig {
    yVaultInterface vault;
    uint256 reserveRateMantissa;
    uint256 maxExitFeeMantissa;
    uint256 maxTimelockDuration;
  }

  event SingleRandomWinnerCreated (
    address indexed singleRandomWinner,
    address indexed ticket,
    address indexed sponsorship
  );

  event yVaultPrizePoolCreated (
    address indexed creator,
    address indexed prizePool,
    address indexed prizeStrategy
  );

  ComptrollerInterface public comptroller;
  yVaultPrizePoolProxyFactory public vaultPrizePoolProxyFactory;
  ControlledTokenProxyFactory public controlledTokenProxyFactory;
  TicketProxyFactory public ticketProxyFactory;
  SingleRandomWinnerProxyFactory public singleRandomWinnerProxyFactory;
  OpenZeppelinProxyFactoryInterface public proxyFactory;
  address public trustedForwarder;

  constructor (
    ComptrollerInterface _comptroller,
    SingleRandomWinnerProxyFactory _singleRandomWinnerProxyFactory,
    address _trustedForwarder,
    yVaultPrizePoolProxyFactory _vaultPrizePoolProxyFactory,
    ControlledTokenProxyFactory _controlledTokenProxyFactory,
    OpenZeppelinProxyFactoryInterface _proxyFactory,
    TicketProxyFactory _ticketProxyFactory
  ) public {
    require(address(_comptroller) != address(0), "yVaultPrizePoolBuilder/comptroller-not-zero");
    require(address(_singleRandomWinnerProxyFactory) != address(0), "yVaultPrizePoolBuilder/single-random-winner-factory-not-zero");
    require(address(_vaultPrizePoolProxyFactory) != address(0), "yVaultPrizePoolBuilder/compound-prize-pool-builder-not-zero");
    require(address(_controlledTokenProxyFactory) != address(0), "yVaultPrizePoolBuilder/controlled-token-proxy-factory-not-zero");
    require(address(_proxyFactory) != address(0), "yVaultPrizePoolBuilder/proxy-factory-not-zero");
    require(address(_ticketProxyFactory) != address(0), "yVaultPrizePoolBuilder/ticket-proxy-factory-not-zero");
    proxyFactory = _proxyFactory;
    ticketProxyFactory = _ticketProxyFactory;
    comptroller = _comptroller;
    singleRandomWinnerProxyFactory = _singleRandomWinnerProxyFactory;
    trustedForwarder = _trustedForwarder;
    vaultPrizePoolProxyFactory = _vaultPrizePoolProxyFactory;
    controlledTokenProxyFactory = _controlledTokenProxyFactory;
  }

  function createSingleRandomWinner(
    yVaultPrizePoolConfig calldata prizePoolConfig,
    SingleRandomWinnerBuilder.SingleRandomWinnerConfig calldata prizeStrategyConfig,
    uint8 decimals
  ) external returns (SingleRandomWinner) {

    SingleRandomWinner prizeStrategy;
    if (prizeStrategyConfig.proxyAdmin != address(0)) {
      prizeStrategy = SingleRandomWinner(
        proxyFactory.deploy(block.timestamp, address(singleRandomWinnerProxyFactory.instance()), prizeStrategyConfig.proxyAdmin, "")
      );
    } else {
      prizeStrategy = singleRandomWinnerProxyFactory.create();
    }

    yVaultPrizePool prizePool = _createyVaultPrizePool(
      prizePoolConfig,
      prizeStrategy
    );

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

  function _createyVaultPrizePool(
    yVaultPrizePoolConfig memory config,
    PrizePoolTokenListenerInterface prizeStrategy
  )
    internal
    returns (yVaultPrizePool)
  {
    yVaultPrizePool prizePool = vaultPrizePoolProxyFactory.create();

    address[] memory tokens;

    prizePool.initialize(
      trustedForwarder,
      prizeStrategy,
      comptroller,
      tokens,
      config.maxExitFeeMantissa,
      config.maxTimelockDuration,
      config.vault,
      config.reserveRateMantissa
    );

    emit yVaultPrizePoolCreated(msg.sender, address(prizePool), address(prizeStrategy));

    return prizePool;
  }

  function createyVaultPrizePool(
    yVaultPrizePoolConfig calldata config,
    PrizePoolTokenListenerInterface prizeStrategy
  )
    external
    returns (yVaultPrizePool)
  {
    yVaultPrizePool prizePool = _createyVaultPrizePool(config, prizeStrategy);
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
