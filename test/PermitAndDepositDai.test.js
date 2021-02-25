const { expect } = require("chai");

const hardhat = require('hardhat')
const {deployMockContract } = require('ethereum-waffle')
const { AddressZero } = hardhat.ethers.constants

const { signDaiPermit } = require('./helpers/signDaiPermit.js')

const toWei = ethers.utils.parseEther

const overrides = { gasLimit: 9500000 }

describe('PermitAndDepositDai', () => {

  let wallet, wallet2

  let provider
  let permitAndDepositDai, dai, prizePool, chainId

  async function permitAndDepositTo({
    prizePool, fromWallet, to, amount
  }) {
    if (!fromWallet) {
      fromWallet = wallet
    }
    const expiry = (new Date().getTime())
    const nonce = 0
    const allowed = true
    let permit = await signDaiPermit(
      wallet,
      {
        name: "Dai Stablecoin",
        version: "1",
        chainId,
        verifyingContract: dai.address,
      },
      {
        holder: wallet.address,
        spender: permitAndDepositDai.address,
        nonce,
        expiry,
        allowed
      }
    )
    let { v, r, s } = ethers.utils.splitSignature(permit.sig)
    return permitAndDepositDai.connect(fromWallet).permitAndDepositTo(
      dai.address, wallet.address, nonce, expiry, allowed, v, r, s,
      prizePool, to, amount, AddressZero, AddressZero
    )
  }

  beforeEach(async () => {
    [wallet, wallet2, wallet3] = await hardhat.ethers.getSigners()
    provider = hardhat.ethers.provider

    // just fake it so that we can call it as if we *were* the prize strategy
    prizePoolAddress = wallet.address

    const network = await provider.getNetwork()
    chainId = network.chainId

    const Dai =  await hre.ethers.getContractFactory("Dai", wallet, overrides)
    dai = await Dai.deploy(chainId)

    const PrizePoolInterface = await hre.artifacts.readArtifact("PrizePoolInterface")
    prizePool = await deployMockContract(wallet, PrizePoolInterface.abi)
 
    const PermitAndDepositDai =  await hre.ethers.getContractFactory("PermitAndDepositDai", wallet, overrides)
    permitAndDepositDai = await PermitAndDepositDai.deploy()
  })

  describe('permitAndDepositTo()', () => {
    it('should work', async () => {
      await dai.mint(wallet.address, toWei('1000'))
      
      await prizePool.mock.depositTo.withArgs(wallet2.address, toWei('100'), AddressZero, AddressZero).returns()
      
      await permitAndDepositTo({
        prizePool: prizePool.address,
        to: wallet2.address,
        amount: toWei('100')
      })

      expect(await dai.allowance(permitAndDepositDai.address, prizePool.address)).to.equal(toWei('100'))
      expect(await dai.balanceOf(permitAndDepositDai.address)).to.equal(toWei('100'))
      expect(await dai.balanceOf(wallet.address)).to.equal(toWei('900'))
    })

    it('should not allow anyone else to use the signature', async () => {
      await dai.mint(wallet.address, toWei('1000'))
      
      await prizePool.mock.depositTo.withArgs(wallet2.address, toWei('100'), AddressZero, AddressZero).returns()
      
      await expect(
        permitAndDepositTo({
          prizePool: prizePool.address,
          to: wallet2.address,
          fromWallet: wallet2,
          amount: toWei('100')
        })
      ).to.be.revertedWith('PermitAndDepositDai/only-signer')
    })
  })

  describe('depositTo()', () => { 
    it('should continue to deposit without additional approvals', async () => {
      await dai.mint(wallet.address, toWei('1000'))
      
      await prizePool.mock.depositTo.withArgs(wallet2.address, toWei('100'), AddressZero, AddressZero).returns()
      
      await permitAndDepositTo({
        prizePool: prizePool.address,
        to: wallet2.address,
        amount: toWei('100')
      })

      await prizePool.mock.depositTo.withArgs(wallet3.address, toWei('50'), AddressZero, AddressZero).returns()

      await permitAndDepositDai.depositTo(
        dai.address, prizePool.address, wallet3.address, toWei('50'), AddressZero, AddressZero
      )

      expect(await dai.allowance(permitAndDepositDai.address, prizePool.address)).to.equal(toWei('50'))
      expect(await dai.balanceOf(permitAndDepositDai.address)).to.equal(toWei('150'))
      expect(await dai.balanceOf(wallet.address)).to.equal(toWei('850'))
    })
  })
})
