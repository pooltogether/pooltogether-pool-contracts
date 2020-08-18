const { expect } = require("chai");
const TicketProxyFactory = require('../build/TicketProxyFactory.json')
const TokenControllerInterface = require('../build/TokenControllerInterface.json')
const buidler = require('@nomiclabs/buidler')
const { deployContract, deployMockContract } = require('ethereum-waffle')

let overrides = { gasLimit: 20000000 }

describe('TicketProxyFactory', () => {

  let wallet, wallet2

  let controller

  let provider

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    factory = await deployContract(wallet, TicketProxyFactory, [], overrides)
    controller = await deployMockContract(wallet, TokenControllerInterface.abi)
  })

  describe('create()', () => {
    it('should create a new prize pool', async () => {
      let tx = await factory.create(overrides)
      let receipt = await provider.getTransactionReceipt(tx.hash)
      let event = factory.interface.parseLog(receipt.logs[0])
      expect(event.name).to.equal('ProxyCreated')

      const ticket = await buidler.ethers.getContractAt("Ticket", event.args.proxy, wallet)

      await ticket.initialize(
        "NAME",
        "SYMBOL",
        wallet._address, // forwarder
        controller.address, // controller
      )

      expect(await ticket.controller()).to.equal(controller.address)
    })
  })
})
