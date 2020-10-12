const { expect } = require("chai");
const PermitAndDepositDai = require('../build/PermitAndDepositDai.json')
const Dai = require('../build/Dai.json')
const PrizePoolInterface = require('../build/PrizePoolInterface.json')
const buidler = require('@nomiclabs/buidler')
const { deployContract, deployMockContract } = require('ethereum-waffle')
const { AddressZero } = buidler.ethers.constants

const { signPermit } = require('./helpers/signPermit.js')

const toWei = ethers.utils.parseEther

const overrides = { gasLimit: 20000000 }

describe('PermitAndDepositDai', () => {

  let wallet, wallet2

  let provider
  let permitAndDepositDai, dai, prizePool, chainId

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    // just fake it so that we can call it as if we *were* the prize strategy
    prizePoolAddress = wallet._address

    const network = await provider.getNetwork()
    chainId = network.chainId

    dai = await deployContract(wallet, Dai, [chainId], overrides)
    prizePool = await deployMockContract(wallet, PrizePoolInterface.abi)
    permitAndDepositDai = await deployContract(wallet, PermitAndDepositDai, [dai.address], overrides)
  })

  describe('permitAndDepositTo', () => {
    it('should work', async () => {
      

      await dai.mint(wallet._address, toWei('1000'))
      
      const expiry = (new Date().getTime())
      const nonce = 0
      const allowed = true

      let permit = await signPermit(
        wallet,
        {
          name: "Dai Stablecoin",
          version: "1",
          chainId,
          verifyingContract: dai.address,
        },
        {
          holder: wallet._address,
          spender: permitAndDepositDai.address,
          nonce,
          expiry,
          allowed
        }
      )

      let { v, r, s } = ethers.utils.splitSignature(permit.sig)

      await prizePool.mock.depositTo.withArgs(wallet2._address, toWei('100'), AddressZero, AddressZero).returns()

      await permitAndDepositDai.permitAndDepositTo(
        wallet._address, nonce, expiry, allowed, v, r, s,
        prizePool.address, wallet2._address, toWei('100'), AddressZero, AddressZero
      )

      expect(await dai.allowance(permitAndDepositDai.address, prizePool.address)).to.equal(toWei('100'))
      expect(await dai.balanceOf(permitAndDepositDai.address)).to.equal(toWei('100'))
      expect(await dai.balanceOf(wallet._address)).to.equal(toWei('900'))
    })
  })

})
