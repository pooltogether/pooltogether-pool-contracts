const { deployContract } = require('ethereum-waffle')
const { deployMockContract } = require('./helpers/deployMockContract')
const StakePrizePoolHarness = require('../build/StakePrizePoolHarness.json')
const TokenListenerInterface = require('../build/TokenListenerInterface.json')
const RegistryInterface = require('../build/RegistryInterface.json')
const ControlledToken = require('../build/ControlledToken.json')
// const CTokenInterface = require('../build/CTokenInterface.json')
const ERC20Mintable = require('../build/ERC20Mintable.json')
const IERC20 = require('../build/IERC20Upgradeable.json')
const IERC721 = require('../build/IERC721Upgradeable.json')

const { ethers } = require('ethers')
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:PrizePool.test')

let overrides = { gasLimit: 20000000 }

describe('StakePrizePool', function() {
  let wallet, wallet2

  let prizePool, erc20token, erc721token, stakeToken, prizeStrategy, registry

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
    stakeToken = await deployMockContract(wallet, ERC20Mintable.abi, overrides)
    // await stakeToken.mock.underlying.returns(erc20token.address)

    prizeStrategy = await deployMockContract(wallet, TokenListenerInterface.abi, overrides)

    await prizeStrategy.mock.supportsInterface.returns(true)
    await prizeStrategy.mock.supportsInterface.withArgs('0xffffffff').returns(false)

    registry = await deployMockContract(wallet, RegistryInterface.abi, overrides)

    debug('deploying StakePrizePoolHarness...')
    prizePool = await deployContract(wallet, StakePrizePoolHarness, [], overrides)

    ticket = await deployMockContract(wallet, ControlledToken.abi, overrides)
    await ticket.mock.controller.returns(prizePool.address)

    initializeTxPromise = prizePool['initialize(address,address[],uint256,uint256,address)'](
      registry.address,
      [ticket.address],
      poolMaxExitFee,
      poolMaxTimelockDuration,
      stakeToken.address
    )

    await initializeTxPromise

    await prizePool.setPrizeStrategy(prizeStrategy.address)
  })

  describe('initialize()', () => {
    it('should initialize the StakePrizePool', async () => {
      await expect(initializeTxPromise)
        .to.emit(prizePool, 'StakePrizePoolInitialized')
        .withArgs(
          stakeToken.address
        )
    })
  })

  describe('_redeem()', () => {
    it('should return amount staked', async () => {
      let amount = toWei('500')

      await stakeToken.mock.balanceOf.withArgs(prizePool.address).returns(toWei('32'))
      await prizePool.redeem(amount)
    })
  })

  describe('canAwardExternal()', () => {
    it('should not allow the stake award', async () => {
      expect(await prizePool.canAwardExternal(stakeToken.address)).to.be.false
    })
  })

  describe('balance()', () => {
    it('should return the staked balance', async () => {
      await stakeToken.mock.balanceOf.withArgs(prizePool.address).returns(toWei('32'))
      expect(await prizePool.callStatic.balance()).to.equal(toWei('32'))
    })
  })

  describe('_token()', () => {
    it('should return the staked token token', async () => {
      expect(await prizePool.token()).to.equal(stakeToken.address)
    })
  })
});
