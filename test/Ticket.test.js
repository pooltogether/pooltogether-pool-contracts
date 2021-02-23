const { deployMockContract } = require('ethereum-waffle')

const { expect } = require('chai')
const hardhat = require('hardhat')
const { AddressZero } = require('ethers').constants

const debug = require('debug')('ptv3:Ticket.test')
const toWei = (val) => ethers.utils.parseEther('' + val)
let overrides = { gasLimit: 9500000 }

describe('Ticket', function() {

  let ticket

  let controller

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await hardhat.ethers.getSigners()
  
    const TokenControllerInterface = await hre.artifacts.readArtifact("TokenControllerInterface")
    controller = await deployMockContract(wallet, TokenControllerInterface.abi) 
    const Ticket = await hre.ethers.getContractFactory("Ticket", wallet, overrides)
    
    ticket = await Ticket.deploy()

    await ticket.initialize("Name", "SYMBOL", 18, controller.address)
    
    // allow all transfers
    await controller.mock.beforeTokenTransfer.returns()
  })

  describe('chanceOf()', () => {
    it('be correct after minting', async () => {
      await controller.call(ticket, 'controllerMint', wallet.address, toWei('100'))
      expect(await ticket.chanceOf(wallet.address)).to.equal(toWei('100'))
    })

    it('should be correct after transfer', async () => {
      await controller.call(ticket, 'controllerMint', wallet.address, toWei('100'))
      
      await ticket.transfer(wallet3.address, toWei('20'))

      expect(await ticket.chanceOf(wallet.address)).to.equal(toWei('80'))
      expect(await ticket.chanceOf(wallet3.address)).to.equal(toWei('20'))
    })

    it('should do nothing when transferring to self', async () => {
      await controller.call(ticket, 'controllerMint', wallet.address, toWei('100'))
      
      await ticket.transfer(wallet.address, toWei('20'))

      expect(await ticket.chanceOf(wallet.address)).to.equal(toWei('100'))
    })

    it('should be correct after burning', async () => {
      await controller.call(ticket, 'controllerMint', wallet.address, toWei('100'))
      await controller.call(ticket, 'controllerBurn', wallet.address, toWei('33'))
      expect(await ticket.chanceOf(wallet.address)).to.equal(toWei('67'))
    })
  })

});
