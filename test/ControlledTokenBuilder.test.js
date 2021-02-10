// const { deployments } = require("hardhat");
const { ethers } = require('ethers')
const { expect } = require('chai')
const hre = require('hardhat')
const { AddressZero } = hre.ethers.constants
const { deployMockContract } = require('./helpers/deployMockContract')


const debug = require('debug')('ptv3:ControlledTokenBuilder.test')

describe('ControlledTokenBuilder', () => {

  let wallet, wallet1

  let controlledTokenProxyFactory,
      controlledTokenBuilder,
      controller

  let controlledTokenConfig

  beforeEach(async () => {
    console.log("start beforeEach")
  
    
    [wallet, wallet1] = await hre.ethers.getSigners()
    console.log("deployments fixture")
    await hre.deployments.fixture()

    console.log("getting controlledTokenBuilder")

    controlledTokenBuilder = await hre.ethers.getContractAt(
      "ControlledTokenBuilder",
      (await deployments.get("ControlledTokenBuilder")).address,
      wallet
    )
    console.log("getting controlled proxy factory")
    controlledTokenProxyFactory = (await deployments.get("ControlledTokenProxyFactory"))
    ticketProxyFactory = (await deployments.get("TicketProxyFactory"))



    console.log("deploying mock")
    const TokenControllerInterface = await hre.artifacts.readArtifact("TokenControllerInterface")
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
      console.log("setting up")
      expect(await controlledTokenBuilder.controlledTokenProxyFactory()).to.equal(controlledTokenProxyFactory.address)
      expect(await controlledTokenBuilder.ticketProxyFactory()).to.equal(ticketProxyFactory.address)
    })
  })

  async function getEvents(tx) {
    let receipt = await hre.ethers.provider.getTransactionReceipt(tx.hash)
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

      const controlledToken = await hre.ethers.getContractAt('ControlledToken', event.args.token, wallet)
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

      const ticket = await hre.ethers.getContractAt('Ticket', event.args.token, wallet)
      expect(await ticket.name()).to.equal(controlledTokenConfig.name)
      expect(await ticket.symbol()).to.equal(controlledTokenConfig.symbol)
      expect(await ticket.decimals()).to.equal(controlledTokenConfig.decimals)
      expect(await ticket.controller()).to.equal(controlledTokenConfig.controller)

      expect(await ticket.draw('0')).to.equal(AddressZero)
    })
  })
})
