const { expect } = require("chai");
const TokenFaucetHarness = require('../build/TokenFaucetHarness.json')
const ERC20 = require('../build/ERC20Mintable.json')
const buidler = require('@nomiclabs/buidler')
const { deployContract } = require('ethereum-waffle')
const { AddressZero } = require("ethers").constants

const toWei = ethers.utils.parseEther

const overrides = { gasLimit: 20000000 }

const debug = require('debug')('ptv3:TokenFaucet.test')

describe('TokenFaucet', () => {

  let wallet, wallet2

  let comptroller, dripToken, measure

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    measure = await deployContract(wallet, ERC20, ['Measure', 'MEAS'])
    dripToken = await deployContract(wallet, ERC20, ['DripToken', 'DRIP'])
    dripRatePerSecond = ethers.utils.parseEther('0.1')

    comptroller = await deployContract(wallet, TokenFaucetHarness, [], overrides)

    await expect(comptroller.initialize(
      dripToken.address,
      measure.address,
      dripRatePerSecond
    )).to.emit(comptroller, 'Initialized')
      .withArgs(
        dripToken.address,
        measure.address,
        dripRatePerSecond
      )
  })

  describe('initialize()', () => {
    it("should set the fields", async () => {
      expect(await comptroller.asset()).to.equal(dripToken.address)
      expect(await comptroller.measure()).to.equal(measure.address)
      expect(await comptroller.dripRatePerSecond()).to.equal(ethers.utils.parseEther('0.1'))
    })

    it('should not be called twice', async () => {
      await expect(comptroller.initialize(
        dripToken.address,
        measure.address,
        dripRatePerSecond
      )).to.be.revertedWith("Initializable: contract is already initialized")
    })
  })

  describe('beforeTokenMint()', () => {
    it('should not drip when no time has passed', async () => {
      await measure.mint(wallet._address, toWei('100'))
      await dripToken.mint(comptroller.address, toWei('100'))
      await expect(
        comptroller.beforeTokenMint(wallet._address, '0', measure.address, AddressZero)
      ).not.to.emit(comptroller, 'Dripped')
    })

    it('should drip tokens on subsequent calls', async () => {
      await measure.mint(wallet._address, toWei('100'))
      await dripToken.mint(comptroller.address, toWei('100'))

      await comptroller.setCurrentTime(10)
      await expect(
        comptroller.beforeTokenMint(wallet._address, '0', measure.address, AddressZero)
      ).to.emit(comptroller, 'Dripped')
        .withArgs(toWei('1'))

      // mintee has balance captured
      let userState = await comptroller.userStates(wallet._address)
      expect(userState.balance).to.equal(toWei('1'))
    })

    it('should not drip when unknown tokens are passed', async () => {
      await measure.mint(wallet._address, toWei('100'))
      await dripToken.mint(comptroller.address, toWei('100'))

      await comptroller.setCurrentTime(10)
      await expect(
        comptroller.beforeTokenMint(wallet._address, '0', wallet._address, AddressZero)
      ).not.to.emit(comptroller, 'Dripped')
    })
  })

  describe('beforeTokenTransfer()', () => {
    it('should do nothing if minting', async () => {
      await measure.mint(wallet._address, toWei('100'))
      await dripToken.mint(comptroller.address, toWei('100'))

      await comptroller.setCurrentTime(10)
      await expect(
        comptroller.beforeTokenTransfer(AddressZero, wallet._address, '0', measure.address)
      ).not.to.emit(comptroller, 'Dripped')
    })

    it('should do nothing if transfer for unrelated token', async () => {
      await measure.mint(wallet._address, toWei('100'))
      await dripToken.mint(comptroller.address, toWei('100'))

      await comptroller.setCurrentTime(10)
      await expect(
        comptroller.beforeTokenTransfer(wallet._address, wallet._address, '0', wallet._address)
      ).not.to.emit(comptroller, 'Dripped')
    })

    it('should update the balance drips', async () => {
      await measure.mint(wallet._address, toWei('80'))
      await measure.mint(wallet2._address, toWei('20'))
      await dripToken.mint(comptroller.address, toWei('100'))

      await comptroller.setCurrentTime(10)
      await expect(
        comptroller.beforeTokenTransfer(wallet._address, wallet2._address, '0', measure.address)
      ).to.emit(comptroller, 'Dripped')
        .withArgs(toWei('1'))

      // from has balance captured
      let userState = await comptroller.userStates(wallet._address)
      expect(userState.balance).to.equal(toWei('0.8'))

      // to has balance captured
      let userState2 = await comptroller.userStates(wallet2._address)
      expect(userState2.balance).to.equal(toWei('0.2'))
    })
  })

  describe('drip()', () => {
    it('should do nothing if there is no supply', async () => {
      // wallet has all measure tokens
      await measure.mint(wallet._address, toWei('100'))
      // drip tokens could have been awarded, but aren't
      await comptroller.setCurrentTime(10)
      await expect(comptroller.drip())
        .not.to.emit(comptroller, 'Dripped')

      // *now* we have tokens
      await dripToken.mint(comptroller.address, toWei('10'))

      // should be tokens minted now
      await comptroller.setCurrentTime(20)
      await expect(comptroller.drip())
        .to.emit(comptroller, 'Dripped')
        .withArgs(toWei('1'))
    })

    it('should cap the dripped amount of tokens to the available balance of assets', async () => {
      // 10 tokens to give
      await dripToken.mint(comptroller.address, toWei('10'))

      // wallet has all measure tokens
      await measure.mint(wallet._address, toWei('100'))

      // half of the drip tokens are awarded
      await comptroller.setCurrentTime(50)
      await expect(comptroller.drip())
        .to.emit(comptroller, 'Dripped')
        .withArgs(toWei('5'))

      // wallet claims them
      await comptroller.claim(wallet._address)
      expect(await dripToken.balanceOf(wallet._address)).to.equal(toWei('5'))

      // long time passes
      await comptroller.setCurrentTime(150)
      // but correct amount of tokens are dripped
      await expect(comptroller.drip())
        .to.emit(comptroller, 'Dripped')
        .withArgs(toWei('5'))

      // wallet claims the rest
      await comptroller.claim(wallet._address)
      expect(await dripToken.balanceOf(wallet._address)).to.equal(toWei('10'))
    })

    it('the drip should pause if no one holds measure tokens', async () => {
      // 10 tokens to give
      await dripToken.mint(comptroller.address, toWei('10'))

      // long time passes
      await comptroller.setCurrentTime(150)
      // nothing should be dripped
      await expect(comptroller.drip())
        .not.to.emit(comptroller, 'Dripped')

      // much later
      await comptroller.setCurrentTime(200)
      // someone mints measure tokens
      await expect(
        comptroller.beforeTokenMint(wallet._address, '0', measure.address, AddressZero)
      ).not.to.emit(comptroller, 'Dripped')
      await measure.mint(wallet._address, toWei('10'))

      // time passes to give away half
      await comptroller.setCurrentTime(250)
      await expect(
        comptroller.beforeTokenTransfer(wallet._address, wallet._address, '0', measure.address)
      ).to.emit(comptroller, 'Dripped')
        .withArgs(toWei('5'))

      // wallet claims its share
      await comptroller.claim(wallet._address)
      expect(await dripToken.balanceOf(wallet._address)).to.equal(toWei('5'))
    })

    it('should be pausable after having dripped some', async () => {
      // 10 tokens to drip out
      await dripToken.mint(comptroller.address, toWei('10'))
      // 10 tokens to measure
      await measure.mint(wallet._address, toWei('10'))

      // move forward 10 seconds so that 1 token drips
      await comptroller.setCurrentTime(10)
      await expect(comptroller.drip())
        .to.emit(comptroller, 'Dripped')
        .withArgs(toWei('1'))

      // user can claim their 1 token
      await comptroller.claim(wallet._address)
      expect(await dripToken.balanceOf(wallet._address)).to.equal(toWei('1'))

      // now have them withdraw entirely
      await measure.burn(wallet._address, toWei('10'))

      // move forward a long time
      await comptroller.setCurrentTime(100)
      // nothing should be dripped
      await expect(comptroller.drip())
        .not.to.emit(comptroller, 'Dripped')

      // now mint more measure tokens
      await measure.mint(wallet._address, toWei('10'))

      // Move forward 10 seconds and drip 1 more
      await comptroller.setCurrentTime(110)
      await expect(comptroller.drip())
        .to.emit(comptroller, 'Dripped')
        .withArgs(toWei('1'))

      // user can claim the second one
      await comptroller.claim(wallet._address)
      expect(await dripToken.balanceOf(wallet._address)).to.equal(toWei('2'))
    })
  })

  describe('claim()', () => {
    it('should allow a longtime holder to claim their share', async () => {
      // 10 tokens to give
      await dripToken.mint(comptroller.address, toWei('10'))

      // wallet has all measure tokens
      await measure.mint(wallet._address, toWei('100'))

      // long time passes
      await comptroller.setCurrentTime(100)

      // all tokens are dripped
      await expect(comptroller.drip())
        .to.emit(comptroller, 'Dripped')
        .withArgs(toWei('10'))

      // wallet claims the rest
      await comptroller.claim(wallet._address)
      expect(await dripToken.balanceOf(wallet._address)).to.equal(toWei('10'))
    })

    it('should not give any tokens to new holders', async () => {
      // 10 tokens to give
      await dripToken.mint(comptroller.address, toWei('10'))

      // wallet has all of measure tokens
      await measure.mint(wallet._address, toWei('100'))

      // half time passes
      await comptroller.setCurrentTime(50)

      // tokens are dripped
      await expect(comptroller.drip())
        .to.emit(comptroller, 'Dripped')
        .withArgs(toWei('5'))

      // wallet2 has no claim
      await comptroller.claim(wallet2._address)
      expect(await dripToken.balanceOf(wallet2._address)).to.equal(toWei('0'))

      // wallet has claim on half
      await comptroller.claim(wallet._address)
      expect(await dripToken.balanceOf(wallet._address)).to.equal(toWei('5'))
    })
  })

  describe('setDripRatePerSecond()', () => {
    it('should allow the owner to change the drip rate', async () => {
      await expect(comptroller.setDripRatePerSecond('1'))
        .to.emit(comptroller, 'DripRateChanged')
        .withArgs('1')
    })

    it('should not allow anyone else to set drip rate', async () => {
      await expect(comptroller.connect(wallet2).setDripRatePerSecond('1'))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('requires that the rip rate be greater than zero', async () => {
      await expect(comptroller.setDripRatePerSecond('0'))
        .to.be.revertedWith('TokenFaucet/dripRate-gt-zero')
    })
  })
})
