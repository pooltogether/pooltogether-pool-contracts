const { deployments } = require("@nomiclabs/buidler");
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { ethers } = require('ethers')
const { AddressZero } = ethers.constants
const { deployMockContract } = require('./helpers/deployMockContract')
const TokenControllerInterface = require('../build/TokenControllerInterface.json')

const debug = require('debug')('ptv3:ControlledTokenBuilder.test')

describe('ControlledTokenBuilder', () => {

  let wallet

  let controlledTokenProxyFactory,
      controlledTokenBuilder,
      controller

  let controlledTokenConfig

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    await deployments.fixture()
    controlledTokenBuilder = await buidler.ethers.getContractAt(
      "ControlledTokenBuilder",
      (await deployments.get("ControlledTokenBuilder")).address,
      wallet
    )

    trustedForwarder = (await deployments.get("TrustedForwarder"))
    controlledTokenProxyFactory = (await deployments.get("ControlledTokenProxyFactory"))
    ticketProxyFactory = (await deployments.get("TicketProxyFactory"))

    controller = await deployMockContract(wallet, TokenControllerInterface.abi)

    controlledTokenConfig = {
      name: "Ticket",
      symbol: "TICK",
      decimals: 18,
      controller: controller.address
    }
  })

  describe('initialize()', () => {
    it('should setup all factories', async () => {
      expect(await controlledTokenBuilder.trustedForwarder()).to.equal(trustedForwarder.address)
      expect(await controlledTokenBuilder.controlledTokenProxyFactory()).to.equal(controlledTokenProxyFactory.address)
      expect(await controlledTokenBuilder.ticketProxyFactory()).to.equal(ticketProxyFactory.address)
    })
  })

  async function getEvents(tx) {
    let receipt = await buidler.ethers.provider.getTransactionReceipt(tx.hash)
    return receipt.logs.reduce((parsedEvents, log) => {
      try {
        parsedEvents.push(controlledTokenBuilder.interface.parseLog(log))
      } catch (e) {}
      return parsedEvents
    }, [])
  }

  describe('createControlledToken()', () => {
    it('should create one', async () => {

      let tx = await controlledTokenBuilder.createControlledToken(controlledTokenConfig)
      let events = await getEvents(tx)
      let event = events.find(e => e.name == 'CreatedControlledToken')

      const controlledToken = await buidler.ethers.getContractAt('ControlledToken', event.args.token, wallet)
      expect(await controlledToken.name()).to.equal(controlledTokenConfig.name)
      expect(await controlledToken.symbol()).to.equal(controlledTokenConfig.symbol)
      expect(await controlledToken.decimals()).to.equal(controlledTokenConfig.decimals)
      expect(await controlledToken.controller()).to.equal(controlledTokenConfig.controller)
    })
  })

  describe('createTicket()', () => {
    it('should create one', async () => {

      let tx = await controlledTokenBuilder.createTicket(controlledTokenConfig)
      let events = await getEvents(tx)
      let event = events.find(e => e.name == 'CreatedTicket')

      const ticket = await buidler.ethers.getContractAt('Ticket', event.args.token, wallet)
      expect(await ticket.name()).to.equal(controlledTokenConfig.name)
      expect(await ticket.symbol()).to.equal(controlledTokenConfig.symbol)
      expect(await ticket.decimals()).to.equal(controlledTokenConfig.decimals)
      expect(await ticket.controller()).to.equal(controlledTokenConfig.controller)

      expect(await ticket.draw('0')).to.equal(AddressZero)
    })
  })
})
