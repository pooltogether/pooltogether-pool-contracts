const { expect } = require("chai");


const hardhat = require('hardhat')
const {  deployMockContract } = require('ethereum-waffle')
const { deployments } = require("hardhat")

let overrides = { gasLimit: 9500000 }

describe('TokenFaucetProxyFactory', () => {

  let wallet, wallet2

  let provider

  let tokenFaucetProxyFactory, measure, asset

  beforeEach(async () => {
    [wallet, wallet2] = await hardhat.ethers.getSigners()
    provider = hardhat.ethers.provider

    const ERC20MintableContract =  await hre.ethers.getContractFactory("ERC20Mintable", wallet, overrides)

    measure = await ERC20MintableContract.deploy('Measure', 'MEAS')
    asset = await ERC20MintableContract.deploy('Measure', 'MEAS')

    await deployments.fixture()
    let tokenFaucetProxyFactoryResult = await deployments.get("TokenFaucetProxyFactory")
    tokenFaucetProxyFactory = await hardhat.ethers.getContractAt('TokenFaucetProxyFactory', tokenFaucetProxyFactoryResult.address, wallet)
  })

  describe('create()', () => {
    it('should create a new comptroller', async () => {
      let tx = await tokenFaucetProxyFactory.create(asset.address, measure.address, ethers.utils.parseEther('0.01'), overrides)
      let receipt = await provider.getTransactionReceipt(tx.hash)
      let event = tokenFaucetProxyFactory.interface.parseLog(receipt.logs[0])
      expect(event.name).to.equal('ProxyCreated')

      let tokenFaucet = await hardhat.ethers.getContractAt("TokenFaucet", event.args.proxy, wallet)

      expect(await tokenFaucet.asset()).to.equal(asset.address)
      expect(await tokenFaucet.measure()).to.equal(measure.address)
      expect(await tokenFaucet.dripRatePerSecond()).to.equal(ethers.utils.parseEther('0.01'))
      expect(await tokenFaucet.owner()).to.equal(wallet.address)
      
    })
  })

  describe('claimAll', () => {
    it('should call claim on comptrollers', async () => {
      const TokenFaucet = await hre.artifacts.readArtifact("TokenFaucet")
      let comptroller = await deployMockContract(wallet, TokenFaucet.abi, overrides)
      await comptroller.mock.claim.withArgs(wallet.address).revertsWithReason("it was called!")

      await expect(tokenFaucetProxyFactory.claimAll(wallet.address, [comptroller.address]))
        .to.be.revertedWith("it was called!")
    })
  })
})
