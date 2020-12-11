const { expect } = require("chai")
const UnsafeTokenListenerDelegatorProxyFactory = require('../build/UnsafeTokenListenerDelegatorProxyFactory.json')
const TokenListenerInterface = require('../build/TokenListenerInterface.json')
const buidler = require('@nomiclabs/buidler')
const { deployContract, deployMockContract } = require('ethereum-waffle')

let overrides = { gasLimit: 20000000 }

describe('UnsafeTokenListenerDelegator', () => {

  let wallet, wallet2

  let provider

  let listener, delegator

  beforeEach(async () => {
    [wallet, wallet2, wallet3] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider
    
    await deployments.fixture()
    factory = await buidler.ethers.getContractAt(
      "UnsafeTokenListenerDelegatorProxyFactory",
      (await deployments.get("UnsafeTokenListenerDelegatorProxyFactory")).address,
      wallet
    )

    listener = await deployMockContract(wallet, TokenListenerInterface.abi)

    let tx = await factory.create(listener.address)
    let receipt = await provider.getTransactionReceipt(tx.hash)
    let event = factory.interface.parseLog(receipt.logs[0])
    expect(event.name).to.equal('ProxyCreated')
    
    delegator = await ethers.getContractAt('UnsafeTokenListenerDelegator', event.args.proxy, wallet)
  })

  describe('beforeTokenTransfer()', () => {
    it('should work', async () => {
      await listener.mock.beforeTokenTransfer.withArgs(wallet._address, wallet2._address, 99, wallet3._address).revertsWithReason("har-har!")
      await expect(delegator.beforeTokenTransfer(wallet._address, wallet2._address, 99, wallet3._address)).to.be.revertedWith("har-har!")
    })
  })

  describe('beforeTokenMint()', () => {
    it('should work', async () => {
      await listener.mock.beforeTokenMint.withArgs(wallet._address, 99, wallet2._address, wallet3._address).revertsWithReason("har-har!")
      await expect(delegator.beforeTokenMint(wallet._address, 99, wallet2._address, wallet3._address)).to.be.revertedWith("har-har!")
    })
  })
})
