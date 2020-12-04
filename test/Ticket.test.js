const { deployContract } = require('ethereum-waffle')
const { deployMockContract } = require('./helpers/deployMockContract')
const TokenControllerInterface = require('../build/TokenControllerInterface.json')
const Ticket = require('../build/Ticket.json')
const chalk = require('chalk')

const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { AddressZero } = require('ethers').constants

const debug = require('debug')('ptv3:Ticket.test')
const toWei = (val) => ethers.utils.parseEther('' + val)
let overrides = { gasLimit: 20000000 }

describe('Ticket', function() {

  let ticket

  let controller

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await buidler.ethers.getSigners()
    controller = await deployMockContract(wallet, TokenControllerInterface.abi)    
    ticket = await deployContract(wallet, Ticket, [], overrides)
    await ticket.initialize("Name", "SYMBOL", 18, AddressZero, controller.address)
    
    // allow all transfers
    await controller.mock.beforeTokenTransfer.returns()
  })

  describe('chanceOf()', () => {
    it('be correct after minting', async () => {
      await controller.call(ticket, 'controllerMint', wallet._address, toWei('100'))
      expect(await ticket.chanceOf(wallet._address)).to.equal(toWei('100'))
    })

    it('should be correct after transfer', async () => {
      await controller.call(ticket, 'controllerMint', wallet._address, toWei('100'))
      
      await ticket.transfer(wallet3._address, toWei('20'))

      expect(await ticket.chanceOf(wallet._address)).to.equal(toWei('80'))
      expect(await ticket.chanceOf(wallet3._address)).to.equal(toWei('20'))
    })

    it('should do nothing when transferring to self', async () => {
      await controller.call(ticket, 'controllerMint', wallet._address, toWei('100'))
      
      await ticket.transfer(wallet._address, toWei('20'))

      expect(await ticket.chanceOf(wallet._address)).to.equal(toWei('100'))
    })

    it('should be correct after burning', async () => {
      await controller.call(ticket, 'controllerMint', wallet._address, toWei('100'))
      await controller.call(ticket, 'controllerBurn', wallet._address, toWei('33'))
      expect(await ticket.chanceOf(wallet._address)).to.equal(toWei('67'))
    })
  })

});
