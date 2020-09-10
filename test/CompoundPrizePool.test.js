const { deployContract } = require('ethereum-waffle')
const { deployMockContract } = require('./helpers/deployMockContract')
const CompoundPrizePoolHarness = require('../build/CompoundPrizePoolHarness.json')
const PrizePoolTokenListenerInterface = require('../build/PrizePoolTokenListenerInterface.json')
const ComptrollerInterface = require('../build/ComptrollerInterface.json')
const ControlledToken = require('../build/ControlledToken.json')
const CTokenInterface = require('../build/CTokenInterface.json')
const IERC20 = require('../build/IERC20.json')
const IERC721 = require('../build/IERC721.json')

const { ethers } = require('ethers')
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:PrizePool.test')

let overrides = { gasLimit: 20000000 }

const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'

describe('CompoundPrizePool', function() {
  let wallet, wallet2

  let prizePool, erc20token, erc721token, cToken, prizeStrategy, comptroller

  let poolMaxExitFee = toWei('0.5')
  let poolMaxTimelockDuration = 10000

  let ticket

  let initializeTxPromise

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    debug(`using wallet ${wallet._address}`)

    debug('mocking tokens...')
    erc20token = await deployMockContract(wallet, IERC20.abi, overrides)
    erc721token = await deployMockContract(wallet, IERC721.abi, overrides)
    cToken = await deployMockContract(wallet, CTokenInterface.abi, overrides)
    await cToken.mock.underlying.returns(erc20token.address)

    prizeStrategy = await deployMockContract(wallet, PrizePoolTokenListenerInterface.abi, overrides)
    comptroller = await deployMockContract(wallet, ComptrollerInterface.abi, overrides)

    debug('deploying CompoundPrizePoolHarness...')
    prizePool = await deployContract(wallet, CompoundPrizePoolHarness, [], overrides)

    ticket = await deployMockContract(wallet, ControlledToken.abi, overrides)
    await ticket.mock.controller.returns(prizePool.address)

    initializeTxPromise = prizePool['initialize(address,address,address,address[],uint256,uint256,address)'](
      FORWARDER,
      prizeStrategy.address,
      comptroller.address,
      [ticket.address],
      poolMaxExitFee,
      poolMaxTimelockDuration,
      cToken.address
    )

    await initializeTxPromise
  })

  describe('initialize()', () => {
    it('should initialize the CompoundPrizePool', async () => {
      await expect(initializeTxPromise)
        .to.emit(prizePool, 'CompoundPrizePoolInitialized')
        .withArgs(
          cToken.address
        )

      expect(await prizePool.cToken()).to.equal(cToken.address)
    })
  })

  describe('_supply()', () => {
    it('should supply assets to compound', async () => {
      let amount = toWei('500')

      await erc20token.mock.approve.withArgs(cToken.address, amount).returns(true)
      await cToken.mock.mint.withArgs(amount).returns('0')
      await prizePool.supply(amount)
    })

    it('should revert on error', async () => {
      let amount = toWei('500')

      await erc20token.mock.approve.withArgs(cToken.address, amount).returns(true)
      await cToken.mock.mint.withArgs(amount).returns('1')
      await expect(prizePool.supply(amount)).to.be.revertedWith('CompoundPrizePool/mint-failed')
    })
  })

  describe('_redeem()', () => {
    it('should redeem assets from Compound', async () => {
      let amount = toWei('500')

      await erc20token.mock.balanceOf.withArgs(prizePool.address).returns(toWei('32'))
      await cToken.mock.redeemUnderlying.withArgs(amount).returns('0')

      await prizePool.redeem(amount)
    })
  })

  describe('canAwardExternal()', () => {
    it('should not allow the cToken award', async () => {
      expect(await prizePool.canAwardExternal(cToken.address)).to.be.false
    })
  })

  describe('balance()', () => {
    it('should return the underlying balance', async () => {
      await cToken.mock.balanceOfUnderlying.withArgs(prizePool.address).returns(toWei('32'))
      expect(await prizePool.callStatic.balance()).to.equal(toWei('32'))
    })
  })

  describe('_token()', () => {
    it('should return the underlying token', async () => {
      expect(await prizePool.token()).to.equal(erc20token.address)
    })
  })

  describe('estimateAccruedInterestOverBlocks()', () => {
    it('should estimate the interest using the supply rate', async () => {
      await cToken.mock.supplyRatePerBlock.returns(toWei('0.01'))

      expect(await prizePool.estimateAccruedInterestOverBlocks(toWei('10'), 10)).to.equal(toWei('1'))
    })
  })

});
