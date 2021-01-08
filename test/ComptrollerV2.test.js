const { expect } = require("chai");
const ComptrollerV2Harness = require('../build/ComptrollerV2Harness.json')
const ERC20 = require('../build/ERC20Mintable.json')
const buidler = require('@nomiclabs/buidler')
const { deployContract } = require('ethereum-waffle')
const { AddressZero } = require("ethers").constants

const toWei = ethers.utils.parseEther

const overrides = { gasLimit: 20000000 }

const debug = require('debug')('ptv3:ComptrollerV2.test')

describe('Comptroller', () => {

  let wallet, wallet2

  let comptroller, dripToken, measure

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    measure = await deployContract(wallet, ERC20, ['Measure', 'MEAS'])
    dripToken = await deployContract(wallet, ERC20, ['DripToken', 'DRIP'])
    dripRatePerSecond = ethers.utils.parseEther('0.1')

    comptroller = await deployContract(wallet, ComptrollerV2Harness, [
      wallet._address,
      dripToken.address,
      measure.address,
      dripRatePerSecond
    ], overrides)
  })

  describe('constructor()', () => {
    it("should set the owner wallet", async () => {
      expect(await comptroller.owner()).to.equal(wallet._address)
    })
  })

  describe('beforeTokenMint()', () => {
    it('should not drip when no time has passed', async () => {
      await measure.mint(wallet._address, toWei('100'))
      await dripToken.mint(comptroller.address, toWei('100'))
      await expect(
        comptroller.beforeTokenMint(wallet._address, '0', measure.address, AddressZero, { from: wallet._address })
      ).not.to.emit(comptroller, 'Dripped')
    })

    it('should drip tokens on subsequent calls', async () => {
      await measure.mint(wallet._address, toWei('100'))
      await dripToken.mint(comptroller.address, toWei('100'))

      await comptroller.setCurrentTime(10)
      await expect(
        comptroller.beforeTokenMint(wallet._address, '0', measure.address, AddressZero, { from: wallet._address })
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
        comptroller.beforeTokenMint(wallet._address, '0', wallet._address, AddressZero, { from: wallet._address })
      ).not.to.emit(comptroller, 'Dripped')
    })
  })

  describe('beforeTokenTransfer()', () => {
    it('should do nothing if minting', async () => {
      await measure.mint(wallet._address, toWei('100'))
      await dripToken.mint(comptroller.address, toWei('100'))

      await comptroller.setCurrentTime(10)
      await expect(
        comptroller.beforeTokenTransfer(AddressZero, wallet._address, '0', measure.address, { from: wallet._address })
      ).not.to.emit(comptroller, 'Dripped')
    })

    it('should do nothing if transfer for unrelated token', async () => {
      await measure.mint(wallet._address, toWei('100'))
      await dripToken.mint(comptroller.address, toWei('100'))

      await comptroller.setCurrentTime(10)
      await expect(
        comptroller.beforeTokenTransfer(wallet._address, wallet._address, '0', wallet._address, { from: wallet._address })
      ).not.to.emit(comptroller, 'Dripped')
    })

    it('should update the balance drips', async () => {
      await measure.mint(wallet._address, toWei('80'))
      await measure.mint(wallet2._address, toWei('20'))
      await dripToken.mint(comptroller.address, toWei('100'))

      await comptroller.setCurrentTime(10)
      await expect(
        comptroller.beforeTokenTransfer(wallet._address, wallet2._address, '0', measure.address, { from: wallet._address })
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
        comptroller.beforeTokenMint(wallet._address, '0', measure.address, AddressZero, { from: wallet._address })
      ).not.to.emit(comptroller, 'Dripped')
      await measure.mint(wallet._address, toWei('10'))

      // time passes to give away half
      await comptroller.setCurrentTime(250)
      await expect(
        comptroller.beforeTokenTransfer(wallet._address, wallet._address, '0', measure.address, { from: wallet._address })
      ).to.emit(comptroller, 'Dripped')
        .withArgs(toWei('5'))

      // wallet claims its share
      await comptroller.claim(wallet._address)
      expect(await dripToken.balanceOf(wallet._address)).to.equal(toWei('5'))
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

      // wallet has half of measure tokens
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
    })
  })

  /*
  describe('drip()', () => {

    it('should handle being initialized', async () => {
      await expect(
        dripExposed.drip(
          toWei('0'), // total supply of tokens
          1, // current timestamp
          unlimitedTokens
        )
      )
        .to.emit(dripExposed, 'DrippedTotalSupply')
        .withArgs('0')
    })

    it('should drip tokens', async () => {
      await expect(
        dripExposed.drip(
          toWei('0'),
          1, // current timestamp
          unlimitedTokens
        )
      )
        .to.emit(dripExposed, 'DrippedTotalSupply')
        .withArgs('0')

      // 10 tokens minted
        
      await expect(
        dripExposed.drip(
          toWei('10'), // 10 tokens 
          2, // current timestamp
          unlimitedTokens
        )
      )
        .to.emit(dripExposed, 'DrippedTotalSupply')
        .withArgs(toWei('0.1'))
    })

    it('should do nothing when run twice', async () => {
      await dripExposed.drip(
        toWei('0'), // total supply of tokens
        1, // current timestamp,
        unlimitedTokens
      )

      await expect(
        dripExposed.dripTwice(
          toWei('100'), // total supply of tokens
          2, // current timestamp
          unlimitedTokens
        )
      )
        .to.emit(dripExposed, 'DrippedTotalSupply')
        .withArgs(toWei('0.1')) // drips same amount
    })

    it('should limit the newly minted tokens', async () => {
      await expect(
        dripExposed.drip(
          toWei('10'), // total supply of tokens
          11, // current timestamp
          unlimitedTokens
        )
      )
        .to.emit(dripExposed, 'DrippedTotalSupply')
        .withArgs('0')

      await expect(
        dripExposed.drip(
          toWei('10'),
          21,
          toWei('0.1')
        )
      )
        .to.emit(dripExposed, 'DrippedTotalSupply')
        .withArgs(toWei('0.1'))
    })

    it('should not drip any tokens the first time it is called', async () => {
      await expect(
        dripExposed.drip(
          toWei('100'), // total supply of tokens
          1, // current timestamp,
          unlimitedTokens
        )
      )
        .to.emit(dripExposed, 'DrippedTotalSupply')
        .withArgs('0')

      expect(await dripExposed.totalDripped()).to.be.equal(toWei('0'))
    })

  })

  describe('captureNewTokensForUser()', () => {

    it('should retroactively drip to a user', async () => {
      await dripExposed.drip(
        toWei('0'), // total supply of tokens
        1, // current timestamp
        unlimitedTokens
      )

      await dripExposed.drip(
        toWei('10'), // total supply of tokens
        11, // current timestamp
        unlimitedTokens
      )

      await expect(
        dripExposed.captureNewTokensForUser(
          wallet._address,
          toWei('10') // user has always held 10 tokens
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet._address, toWei('1'))

      expect(await dripExposed.totalDripped()).to.be.equal(toWei('1'))
    })

    it('should spread the drip across different users', async () => {
      
      // assume wallet 1 holds 10 tokens

      // initialize drip
      await dripExposed.drip(
        toWei('10'), // total supply of tokens
        1, // current timestamp
        unlimitedTokens
      )

      // wallet 2 buys 10 tokens.
      // before the mint must drip
      await expect(
        dripExposed.drip(
          toWei('10'), // total supply of tokens before the mint
          11, // current timestamp
          unlimitedTokens
        )
      )
        .to.emit(dripExposed, 'DrippedTotalSupply')
        .withArgs(toWei('1'))
      // before the mint we also capture the users balance
      await expect(
        dripExposed.captureNewTokensForUser(
          wallet2._address,
          toWei('0') // user has always held 10 tokens
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet2._address, toWei('0'))

      // Now let's drip right before we capture
      await expect(
        dripExposed.drip(
          toWei('20'), // total supply of tokens
          21, // current timestamp
          unlimitedTokens
        )
      )
        .to.emit(dripExposed, 'DrippedTotalSupply')
        .withArgs(toWei('1'))
      // wallet 1 had 100% for 10 seconds, then 50% for ten seconds
      await expect(
        dripExposed.captureNewTokensForUser(
          wallet._address,
          toWei('10')
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet._address, toWei('1.5'))
      // wallet 2 had 50% of the supply for 10 seconds
      await expect(
        dripExposed.captureNewTokensForUser(
          wallet2._address,
          toWei('10')
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet2._address, toWei('0.5'))

    })
  })
  */
})
