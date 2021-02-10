const { expect } = require("chai")

const hardhat = require('hardhat')
const { deployMockContract } = require('ethereum-waffle')

let overrides = { gasLimit: 9500000 }

describe('UnsafeTokenListenerDelegator', () => {

  let wallet, wallet2

  let provider

  let listener, delegator

  beforeEach(async () => {
    [wallet, wallet2, wallet3] = await hardhat.ethers.getSigners()
    provider = hardhat.ethers.provider
    
    await deployments.fixture()
    factory = await hardhat.ethers.getContractAt(
      "UnsafeTokenListenerDelegatorProxyFactory",
      (await deployments.get("UnsafeTokenListenerDelegatorProxyFactory")).address,
      wallet
    )


    const TokenListenerInterface = await hre.artifacts.readArtifact("TokenListenerInterface")
    listener = await deployMockContract(wallet, TokenListenerInterface.abi)

    let tx = await factory.create(listener.address)
    let receipt = await provider.getTransactionReceipt(tx.hash)
    let event = factory.interface.parseLog(receipt.logs[0])
    expect(event.name).to.equal('ProxyCreated')
    
    delegator = await ethers.getContractAt('UnsafeTokenListenerDelegator', event.args.proxy, wallet)
  })

  describe('beforeTokenTransfer()', () => {
    it('should work', async () => {
      await listener.mock.beforeTokenTransfer.withArgs(wallet.address, wallet2.address, 99, wallet3.address).revertsWithReason("har-har!")
      await expect(delegator.beforeTokenTransfer(wallet.address, wallet2.address, 99, wallet3.address)).to.be.revertedWith("har-har!")
    })
  })

  describe('beforeTokenMint()', () => {
    it('should work', async () => {
      await listener.mock.beforeTokenMint.withArgs(wallet.address, 99, wallet2.address, wallet3.address).revertsWithReason("har-har!")
      await expect(delegator.beforeTokenMint(wallet.address, 99, wallet2.address, wallet3.address)).to.be.revertedWith("har-har!")
    })
  })
})
