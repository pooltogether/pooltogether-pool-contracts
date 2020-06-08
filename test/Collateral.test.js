const { deployContract, deployMockContract } = require('ethereum-waffle')
const CreditReserve = require('../build/CreditReserve.json')
const Collateral = require('../build/Collateral.json')
const {
  COLLATERAL_INTERFACE_HASH
} = require('../js/constants')

const PrizePoolModuleManager = require('../build/PrizePoolModuleManager.json')
const { ethers } = require('./helpers/ethers')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')

const toWei = ethers.utils.parseEther
const fromWei = ethers.utils.formatEther

const debug = require('debug')('ptv3:Collateral.test')

const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'

let overrides = { gasLimit: 20000000 }

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('Collateral', function() {

  let wallet

  let collateral, creditReserve, manager

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()

    manager = await deployMockContract(wallet, PrizePoolModuleManager.abi, overrides)
    creditReserve = await deployMockContract(wallet, CreditReserve.abi, overrides)

    await manager.mock.enableModuleInterface.withArgs(COLLATERAL_INTERFACE_HASH).returns()
    await manager.mock.creditReserve.returns(creditReserve.address)
    await manager.mock.isModuleEnabled.withArgs(wallet._address).returns(true)

    collateral = await deployContract(wallet, Collateral, [], overrides)
    await collateral.initialize(manager.address, FORWARDER)
  })

  describe('supply()', () => {
    it('should increase the users balance', async () => {
      await collateral.supply(wallet._address, toWei('10'))

      expect(await collateral.balanceOf(wallet._address)).to.equal(toWei('10'))
      expect(await collateral.ratioMantissa(wallet._address)).to.equal(toWei('0'))
    })

    async function showCredit() {
      debug({ wallet: fromWei(await collateral.balanceOfCredit(wallet._address)).toString() })
      debug({ forwarder: fromWei(await collateral.balanceOfCredit(FORWARDER)).toString() })
    }

    it('should accurately record the users interest', async () => {

      // two users join the pool with the same amount
      await collateral.supply(wallet._address, toWei('100'))
      await collateral.supply(FORWARDER, toWei('100'))

      let prize1 = '39.01851372'
      // prize accrues
      await collateral.spread(toWei(prize1))
      // prize is awarded to the winner
      await collateral.supply(FORWARDER, toWei(prize1))

      // await showCredit()

      // prize accrues
      let prize2 = '52.34372078'
      await collateral.spread(toWei(prize2))
      // prize is awarded to the winner
      await collateral.supply(wallet._address, toWei(prize2))

      // await showCredit()

      let prize3 = '63.80670355'
      // prize accrues
      await collateral.spread(toWei(prize3))
      // prize is awarded to the winner
      await collateral.supply(FORWARDER, toWei(prize3))

      await showCredit()

      expect(await collateral.balanceOfCredit(wallet._address)).to.equal(toWei('226.753787811082561455'))
      expect(await collateral.balanceOfCredit(FORWARDER)).to.equal(toWei('283.584088288917438496'))
    })
  })

  describe('spread()', () => {
    it('should evenly disperse collateral', async () => {
      await collateral.supply(wallet._address, toWei('20'))
      await collateral.supply(FORWARDER, toWei('10'))

      await collateral.spread(toWei('30'))

      expect(await collateral.balanceOfCredit(wallet._address)).to.equal(toWei('40'))
      expect(await collateral.balanceOfCredit(FORWARDER)).to.equal(toWei('20'))
    })
  })

  describe('ratioMantissa', () => {
    it('should calculate the collateralization for a user', async () => {
      await collateral.supply(wallet._address, toWei('40'))
      await collateral.supply(FORWARDER, toWei('10'))
      await collateral.spread(toWei('25'))

      expect(await collateral.ratioMantissa(wallet._address)).to.equal(toWei('0.5'))
      expect(await collateral.ratioMantissa(FORWARDER)).to.equal(toWei('0.5'))
    })
  })
});
