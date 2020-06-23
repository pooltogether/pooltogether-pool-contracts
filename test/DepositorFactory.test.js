const { expect } = require('chai')
const DepositorFactory = require('../build/DepositorFactory.json')
const PeriodicPrizePoolInterface = require('../build/PeriodicPrizePoolInterface.json')
const IERC20 = require('../build/IERC20.json')
const { ethers } = require('./helpers/ethers')
const buidler = require('./helpers/buidler')
const { deployContract, deployMockContract } = require('ethereum-waffle')

const toWei = ethers.utils.parseEther

describe('DepositorFactory', () => {
  
  let wallet, wallet2

  let token, prizePool

  let provider

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    token = await deployMockContract(wallet, IERC20.abi)
    prizePool = await deployMockContract(wallet, PeriodicPrizePoolInterface.abi)
    await prizePool.mock.token.returns(token.address)

    depositorFactory = await deployContract(wallet, DepositorFactory, [])
    await depositorFactory.initialize(prizePool.address)
  })

  describe('deposit', () => {
    it('should allow deposit from anyone', async () => {
      let address = await depositorFactory.calculateAddress(wallet._address)
      let depositAmount = toWei('100')

      await token.mock.balanceOf.withArgs(address).returns(depositAmount)
      await token.mock.approve.withArgs(prizePool.address, depositAmount).returns(true)
      await prizePool.mock.mintTickets.withArgs(wallet._address, depositAmount, []).returns()

      await depositorFactory.deposit(wallet._address, [])
    })
  })

  describe('code()', () => {
    it("should show the same code", async () => {
      let code = await depositorFactory.code()

      expect(code.length).to.equal(112)
    })
  })

})
