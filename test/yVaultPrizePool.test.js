const { deployMockContract } = require('ethereum-waffle')


const { ethers } = require('ethers')
const { expect } = require('chai')
const hardhat = require('hardhat')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:yVaultPrizePool.test')

let overrides = { gasLimit: 9500000 }

describe('yVaultPrizePool', function() {
  let wallet, wallet2

  let prizePool, erc20token, vault, prizeStrategy, comptroller

  let poolMaxExitFee = toWei('0.5')
  let poolMaxTimelockDuration = 10000

  let ticket

  let initializeTxPromise

  beforeEach(async () => {
    [wallet, wallet2] = await hardhat.ethers.getSigners()
    debug(`using wallet ${wallet.address}`)

    debug('creating token...')
    const ERC20MintableContract =  await hre.ethers.getContractFactory("ERC20Mintable", wallet, overrides)
 
    erc20token = await ERC20MintableContract.deploy("Token", "TOKE")

    debug('creating vault...')
    const yVaultMock =  await hre.ethers.getContractFactory("yVaultMock", wallet, overrides)
    vault = await yVaultMock.deploy(erc20token.address)

    const TokenListenerInterface = await hre.artifacts.readArtifact("TokenListenerInterface")
    prizeStrategy = await deployMockContract(wallet, TokenListenerInterface.abi, overrides)

    await prizeStrategy.mock.supportsInterface.returns(true)
    await prizeStrategy.mock.supportsInterface.withArgs('0xffffffff').returns(false)

    comptroller = await deployMockContract(wallet, TokenListenerInterface.abi, overrides)

    debug('deploying yVaultPrizePoolHarness...')
    const yVaultPrizePoolHarness =  await hre.ethers.getContractFactory("yVaultPrizePoolHarness", wallet, overrides)
    prizePool = await yVaultPrizePoolHarness.deploy()

    const ControlledToken = await hre.artifacts.readArtifact("ControlledToken")
    ticket = await deployMockContract(wallet, ControlledToken.abi, overrides)
    await ticket.mock.controller.returns(prizePool.address)

    initializeTxPromise = prizePool['initialize(address,address[],uint256,uint256,address,uint256)'](
      comptroller.address,
      [ticket.address],
      poolMaxExitFee,
      poolMaxTimelockDuration,
      vault.address,
      toWei('0.05')
    )

    await initializeTxPromise

    await prizePool.setPrizeStrategy(prizeStrategy.address)
  })

  describe('initialize()', () => {
    it('should initialize the CompoundPrizePool', async () => {
      await expect(initializeTxPromise)
        .to.emit(prizePool, 'yVaultPrizePoolInitialized')
        .withArgs(
          vault.address
        )

      expect(await prizePool.vault()).to.equal(vault.address)
    })
  })

  describe('setReserveRateMantissa()', () => {
    it('should allow the owner to set the reserve rate', async () => {
      await prizePool.setReserveRateMantissa(toWei('0.1'))
      expect(await prizePool.reserveRateMantissa()).to.equal(toWei('0.1'))
    })

    it('should not allow anyone but the owner to set the reserve rate mantissa', async () => {
      await expect(prizePool.connect(wallet2).setReserveRateMantissa(toWei('0.1'))).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('_supply()', () => {
    it('should supply funds from the user', async () => {
      let amount = toWei('500')
      await erc20token.mint(prizePool.address, amount)
      await prizePool.supply(amount)
      expect(await erc20token.balanceOf(vault.address)).to.equal(amount)
    })

    it('should supply any additional funds held by the prize pool', async () => {
      let amount = toWei('500')
      await erc20token.mint(prizePool.address, amount)
      await erc20token.mint(prizePool.address, amount)
      await prizePool.supply(amount)
      expect(await erc20token.balanceOf(vault.address)).to.equal(toWei('1000'))
    })
  })

  describe('_redeem()', () => {
    let amount

    beforeEach(async () => {
      amount = toWei('300')
      await erc20token.mint(prizePool.address, amount)
      await prizePool.supply(amount)
    })

    it('should revert if reserve is exceeded', async () => {
      await expect(prizePool.redeem(amount)).to.be.revertedWith("yVaultPrizePool/insuff-liquidity")
    })

    it('should allow a user to withdraw', async () => {
      expect(await prizePool.callStatic.redeem(toWei('100'))).to.equal(toWei('100'))
      await prizePool.redeem(toWei('100'))
      // deposit plus reserve has been withdrawn
      expect(await erc20token.balanceOf(prizePool.address)).to.equal(toWei('100'))
      expect(await erc20token.balanceOf(vault.address)).to.equal(toWei('200'))
    })

    it('should allow withdraw after reserve is met', async () => {
      await erc20token.mint(vault.address, toWei('100'))

      await prizePool.redeem(amount)
      // deposit plus reserve has been withdrawn.
      expect(await erc20token.balanceOf(prizePool.address)).to.equal('300000000000000000000')
      expect(await erc20token.balanceOf(vault.address)).to.equal('100000000000000000000')
    })

    it('should redeem less if the vault has decreased', async () => {
      await vault.setVaultFeeMantissa(toWei('0'))

      expect(await prizePool.callStatic.redeem(toWei('100'))).to.equal(toWei('100'))

      await prizePool.redeem(toWei('100'))
      // deposit plus reserve has been withdrawn.
      expect(await erc20token.balanceOf(prizePool.address)).to.equal(toWei('100'))
      expect(await erc20token.balanceOf(vault.address)).to.equal(toWei('200'))
    })
  })

  describe('canAwardExternal()', () => {
    it('should not allow awarding of either vault token or token token', async () => {
      expect(await prizePool.canAwardExternal(vault.address)).to.be.false
      expect(await prizePool.canAwardExternal(erc20token.address)).to.be.false
    })
  })

  describe('balance()', () => {
    it('should return zero when nothing', async () => {
      expect(await prizePool.callStatic.balance()).to.equal(toWei('0'))
    })

    it('should return the balance less reserve', async () => {
      let amount = toWei('100')

      await erc20token.mint(prizePool.address, amount)
      await prizePool.supply(amount)

      expect(await prizePool.callStatic.balance()).to.equal(toWei('95'))

      await erc20token.mint(vault.address, amount)

      expect(await prizePool.callStatic.balance()).to.equal(toWei('190'))
    })
  })

  describe('_token()', () => {
    it('should return the underlying token', async () => {
      expect(await prizePool.token()).to.equal(erc20token.address)
    })
  })
})
