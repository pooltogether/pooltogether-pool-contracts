const { deployContract } = require('ethereum-waffle')
const { deployMockContract } = require('./helpers/deployMockContract')
const AavePrizePoolHarness = require('../build/AavePrizePoolHarness.json')
const TokenListenerInterface = require('../build/TokenListenerInterface.json')
const ControlledToken = require('../build/ControlledToken.json')
const ATokenInterface = require('../build/ATokenInterface.json')
const LendingPoolAddressesProviderInterface = require('../build/LendingPoolAddressesProviderInterface.json')
const LendingPoolInterface = require('../build/LendingPoolInterface.json')
const IERC20 = require('../build/IERC20.json')
const IERC721 = require('../build/IERC721.json')

const { ethers } = require('ethers')
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:PrizePool.test')

let overrides = { gasLimit: 20000000 }

const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'

describe('AavePrizePool', function() {
  let wallet, wallet2

  let prizePool,
    erc20token,
    erc721token,
    aToken,
    prizeStrategy,
    comptroller,
    lendingPoolAddressesProvider,
    lendingPool

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
    aToken = await deployMockContract(wallet, ATokenInterface.abi, overrides)

    lendingPoolAddressesProvider = await deployMockContract(
      wallet,
      LendingPoolAddressesProviderInterface.abi,
      overrides
    )

    lendingPool = await deployMockContract(wallet, LendingPoolInterface.abi, overrides)

    await lendingPoolAddressesProvider.mock.getLendingPool.returns(lendingPool.address)

    await lendingPoolAddressesProvider.mock.getLendingPoolCore
      .returns('0x506B0B2CF20FAA8f38a4E2B524EE43e1f4458Cc5')

    await aToken.mock.underlyingAssetAddress.returns(erc20token.address)

    prizeStrategy = await deployMockContract(wallet, TokenListenerInterface.abi, overrides)
    comptroller = await deployMockContract(wallet, TokenListenerInterface.abi, overrides)

    debug('deploying AavePrizePoolHarness...')
    prizePool = await deployContract(wallet, AavePrizePoolHarness, [], overrides)

    ticket = await deployMockContract(wallet, ControlledToken.abi, overrides)
    await ticket.mock.controller.returns(prizePool.address)

    initializeTxPromise = prizePool[
      'initialize(address,address,address[],uint256,uint256,address,address)'
    ](
      FORWARDER,
      comptroller.address,
      [ticket.address],
      poolMaxExitFee,
      poolMaxTimelockDuration,
      aToken.address,
      lendingPoolAddressesProvider.address,
    )

    await initializeTxPromise

    await prizePool.setPrizeStrategy(prizeStrategy.address)
  })

  describe('initialize()', () => {
    it('should initialize the AavePrizePool', async () => {
      await expect(initializeTxPromise)
        .to.emit(prizePool, 'AavePrizePoolInitialized')
        .withArgs(aToken.address, lendingPoolAddressesProvider.address)

      expect(await prizePool.aToken()).to.equal(aToken.address)
      expect(await prizePool.lendingPoolAddressesProviderAddress()).to.equal(
        lendingPoolAddressesProvider.address
      )
    })
  })

  describe('_supply()', () => {
    let amount
    let lendingPoolCoreAddress
    let tokenAddress

    beforeEach(async () => {
      amount = toWei('500')
      lendingPoolCoreAddress = await lendingPoolAddressesProvider.getLendingPoolCore()
      tokenAddress = await prizePool.tokenAddress()

      await erc20token.mock.approve.withArgs(lendingPoolCoreAddress, amount).returns(true)
      await lendingPool.mock.deposit.withArgs(erc20token.address, amount, 138).returns()
      await prizePool.supply(amount)
    })

    it('should supply assets to Aave', async () => {
      await erc20token.mock.approve.withArgs(lendingPoolCoreAddress, amount).returns(true)
      await lendingPool.mock.deposit.withArgs(tokenAddress, amount, 138).returns()

      await prizePool.supply(amount)
    })

    it('should revert on error', async () => {
      await erc20token.mock.approve.withArgs(lendingPoolCoreAddress, amount).returns(true)
      await lendingPool.mock.deposit.withArgs(tokenAddress, amount, 138).reverts()

      expect(prizePool.supply(amount)).to.be.revertedWith('')
    })
  })

  describe('_redeem()', () => {
    it('should redeem assets from Aave', async () => {
      let amount = toWei('300')
      let redeemAmount = toWei('100')

      await erc20token.mock.balanceOf.withArgs(prizePool.address).returns(amount)
      await aToken.mock.redeem.withArgs(redeemAmount).returns()

      await prizePool.redeem(redeemAmount)
    })
  })

  describe('canAwardExternal()', () => {
    it('should not allow the aToken award', async () => {
      expect(await prizePool.canAwardExternal(aToken.address)).to.be.false
    })
  })

  describe('balance()', () => {
    it('should return the underlying balance', async () => {
      const balance = toWei('32');

      await aToken.mock.balanceOf.withArgs(prizePool.address).returns(balance)
      expect(await prizePool.callStatic.balance()).to.equal(balance)
    })
  })

  describe('_token()', () => {
    it('should return the underlying token', async () => {
      expect(await prizePool.token()).to.equal(erc20token.address)
    })
  })
});
