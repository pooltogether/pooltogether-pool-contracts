const { expect } = require("chai");


const hardhat = require('hardhat')
const {  deployMockContract } = require('ethereum-waffle')
const { deployments } = require("hardhat")

let overrides = { gasLimit: 9500000 }

describe('TokenFaucetProxyFactory', () => {

  let wallet, wallet2

  let provider

  let comptrollerV2ProxyFactory, measure, asset

  beforeEach(async () => {
    [wallet, wallet2] = await hardhat.ethers.getSigners()
    provider = hardhat.ethers.provider

    const ERC20MintableContract =  await hre.ethers.getContractFactory("ERC20Mintable", wallet, overrides)

    measure = await ERC20MintableContract.deploy('Measure', 'MEAS')
    asset = await ERC20MintableContract.deploy('Measure', 'MEAS')

    await deployments.fixture()
    let comptrollerV2ProxyFactoryResult = await deployments.get("TokenFaucetProxyFactory")
    comptrollerV2ProxyFactory = await hardhat.ethers.getContractAt('TokenFaucetProxyFactory', comptrollerV2ProxyFactoryResult.address, wallet)
  })

  describe('create()', () => {
    it('should create a new comptroller', async () => {
      let tx = await comptrollerV2ProxyFactory.create(asset.address, measure.address, ethers.utils.parseEther('0.01'), overrides)
      let receipt = await provider.getTransactionReceipt(tx.hash)
      let event = comptrollerV2ProxyFactory.interface.parseLog(receipt.logs[0])
      expect(event.name).to.equal('ProxyCreated')

      let comptrollerV2 = await hardhat.ethers.getContractAt("TokenFaucet", event.args.proxy, wallet)

      expect(await comptrollerV2.asset()).to.equal(asset.address)
      expect(await comptrollerV2.measure()).to.equal(measure.address)
      expect(await comptrollerV2.dripRatePerSecond()).to.equal(ethers.utils.parseEther('0.01'))
      expect(await comptrollerV2.owner()).to.equal(wallet.address)
      
    })
  })

  describe('claimAll', () => {
    it('should call claim on comptrollers', async () => {
      const TokenFaucet = await hre.artifacts.readArtifact("TokenFaucet")
      let comptroller = await deployMockContract(wallet, TokenFaucet.abi, overrides)
      await comptroller.mock.claim.withArgs(wallet.address).revertsWithReason("it was called!")

      await expect(comptrollerV2ProxyFactory.claimAll(wallet.address, [comptroller.address]))
        .to.be.revertedWith("it was called!")
    })
  })
})
