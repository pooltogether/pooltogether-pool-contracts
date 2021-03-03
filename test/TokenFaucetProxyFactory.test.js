const { expect } = require("chai");
const hardhat = require('hardhat')
const {  deployMockContract } = require('ethereum-waffle')
const { deployments } = require("hardhat")

const toWei = hardhat.ethers.utils.parseEther

const debug = require('debug')('ptv3:TokenFaucetProxyFactory.test')

let overrides = { gasLimit: 9500000 }

describe('TokenFaucetProxyFactory', () => {

  let wallet, wallet2

  let provider

  let tokenFaucetProxyFactory, measure, asset

  beforeEach(async () => {
    [wallet, wallet2] = await hardhat.ethers.getSigners()

    await deployments.fixture()
    
    provider = hardhat.ethers.provider
    
    const ERC20MintableContract =  await hardhat.ethers.getContractFactory("ERC20Mintable", wallet, overrides)
    
    measure = await ERC20MintableContract.deploy('Measure', 'MEAS')
    asset = await ERC20MintableContract.deploy('Asset', 'ASS')
    
    tokenFaucetProxyFactory = await hardhat.ethers.getContract('TokenFaucetProxyFactory', wallet)
  })

  describe('create()', () => {
    it('should create a new faucet', async () => {
      let tx = await tokenFaucetProxyFactory.create(asset.address, measure.address, toWei('0.01'), overrides)
      let receipt = await provider.getTransactionReceipt(tx.hash)
      let event = tokenFaucetProxyFactory.interface.parseLog(receipt.logs[0])
      expect(event.name).to.equal('ProxyCreated')

      let tokenFaucet = await hardhat.ethers.getContractAt("TokenFaucet", event.args.proxy, wallet)

      expect(await tokenFaucet.asset()).to.equal(asset.address)
      expect(await tokenFaucet.measure()).to.equal(measure.address)
      expect(await tokenFaucet.dripRatePerSecond()).to.equal(toWei('0.01'))
      expect(await tokenFaucet.owner()).to.equal(wallet.address)
    })
  })

  describe('createAndDeposit()', () => {
    it('should create a new faucet and immediately deposit into it', async () => {
      debug(`createAndDeposit() minting...`)
      await asset.mint(wallet.address, toWei('100'))
      debug(`createAndDeposit() approving...`)
      await asset.approve(tokenFaucetProxyFactory.address, toWei('100'))

      debug(`createAndDeposit() create and deposit for ${asset.address} ${measure.address}...`)
      let tx = await tokenFaucetProxyFactory.createAndDeposit(asset.address, measure.address, toWei('0.01'), toWei('100'), overrides)

      debug(`createAndDeposit() getTransactionReceipt...`)
      let receipt = await provider.getTransactionReceipt(tx.hash)
      let event = tokenFaucetProxyFactory.interface.parseLog(receipt.logs[0])
      expect(event.name).to.equal('ProxyCreated')

      debug(`createAndDeposit() get TokenFaucet contract...`)
      let tokenFaucet = await hardhat.ethers.getContractAt("TokenFaucet", event.args.proxy, wallet)

      expect(await asset.balanceOf(tokenFaucet.address)).to.equal(toWei('100'))
    })
  })

  describe('claimAll', () => {
    it('should call claim on faucets', async () => {
      const TokenFaucet = await hardhat.artifacts.readArtifact("TokenFaucet")
      let faucet = await deployMockContract(wallet, TokenFaucet.abi, overrides)
      await faucet.mock.claim.withArgs(wallet.address).revertsWithReason("it was called!")

      await expect(tokenFaucetProxyFactory.claimAll(wallet.address, [faucet.address]))
        .to.be.revertedWith("it was called!")
    })
  })
})
