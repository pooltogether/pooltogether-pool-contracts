const { expect } = require("chai");
const hardhat = require('hardhat')
const { deployContract } = require('ethereum-waffle')
const { AddressZero } = require("ethers").constants

const toWei = ethers.utils.parseEther

const overrides = { gasLimit: 9500000 }

const debug = require('debug')('ptv3:TokenFaucet.test')

describe('TokenFaucet', () => {

  let wallet, wallet2

  let faucet, dripToken, measure

  beforeEach(async () => {
    [wallet, wallet2] = await hardhat.ethers.getSigners()
    provider = hardhat.ethers.provider


    const ERC20MintableContract =  await hre.ethers.getContractFactory("ERC20Mintable", wallet, overrides)
  

    measure = await ERC20MintableContract.deploy('Measure', 'MEAS')


    dripToken = await ERC20MintableContract.deploy('DripToken', 'DRIP')

    dripRatePerSecond = ethers.utils.parseEther('0.1')

    const TokenFaucetHarness =  await hre.ethers.getContractFactory("TokenFaucetHarness", wallet, overrides)
    faucet = await TokenFaucetHarness.deploy()

    await expect(faucet.initialize(
      dripToken.address,
      measure.address,
      dripRatePerSecond
    )).to.emit(faucet, 'Initialized')
      .withArgs(
        dripToken.address,
        measure.address,
        dripRatePerSecond
      )
  })

  describe('initialize()', () => {
    it("should set the fields", async () => {
      expect(await faucet.asset()).to.equal(dripToken.address)
      expect(await faucet.measure()).to.equal(measure.address)
      expect(await faucet.dripRatePerSecond()).to.equal(ethers.utils.parseEther('0.1'))
    })

    it('should not be called twice', async () => {
      await expect(faucet.initialize(
        dripToken.address,
        measure.address,
        dripRatePerSecond
      )).to.be.revertedWith("Initializable: contract is already initialized")
    })
  })

  describe('beforeTokenMint()', () => {
    it('should not drip when no time has passed', async () => {
      await measure.mint(wallet.address, toWei('100'))
      await dripToken.mint(faucet.address, toWei('100'))
      await expect(
        faucet.beforeTokenMint(wallet.address, '0', measure.address, AddressZero)
      ).not.to.emit(faucet, 'Dripped')
    })

    it('should drip tokens on subsequent calls', async () => {
      await measure.mint(wallet.address, toWei('100'))
      await dripToken.mint(faucet.address, toWei('100'))

      await faucet.setCurrentTime(10)
      await expect(
        faucet.beforeTokenMint(wallet.address, '0', measure.address, AddressZero)
      ).to.emit(faucet, 'Dripped')
        .withArgs(toWei('1'))

      // mintee has balance captured
      let userState = await faucet.userStates(wallet.address)
      expect(userState.balance).to.equal(toWei('1'))
    })

    it('should not drip when unknown tokens are passed', async () => {
      await measure.mint(wallet.address, toWei('100'))
      await dripToken.mint(faucet.address, toWei('100'))

      await faucet.setCurrentTime(10)
      await expect(
        faucet.beforeTokenMint(wallet.address, '0', wallet.address, AddressZero)
      ).not.to.emit(faucet, 'Dripped')
    })
  })

  describe('beforeTokenTransfer()', () => {
    it('should do nothing if minting', async () => {
      await measure.mint(wallet.address, toWei('100'))
      await dripToken.mint(faucet.address, toWei('100'))

      await faucet.setCurrentTime(10)
      await expect(
        faucet.beforeTokenTransfer(AddressZero, wallet.address, '0', measure.address)
      ).not.to.emit(faucet, 'Dripped')
    })

    it('should do nothing if transfer for unrelated token', async () => {
      await measure.mint(wallet.address, toWei('100'))
      await dripToken.mint(faucet.address, toWei('100'))

      await faucet.setCurrentTime(10)
      await expect(
        faucet.beforeTokenTransfer(wallet.address, wallet.address, '0', wallet.address)
      ).not.to.emit(faucet, 'Dripped')
    })

    it('should update the balance drips', async () => {
      await measure.mint(wallet.address, toWei('80'))
      await measure.mint(wallet2.address, toWei('20'))
      await dripToken.mint(faucet.address, toWei('100'))

      await faucet.setCurrentTime(10)
      await expect(
        faucet.beforeTokenTransfer(wallet.address, wallet2.address, '0', measure.address)
      ).to.emit(faucet, 'Dripped')
        .withArgs(toWei('1'))

      // from has balance captured
      let userState = await faucet.userStates(wallet.address)
      expect(userState.balance).to.equal(toWei('0.8'))

      // to has balance captured
      let userState2 = await faucet.userStates(wallet2.address)
      expect(userState2.balance).to.equal(toWei('0.2'))
    })
  })

  describe('drip()', () => {
    it('should do nothing if there is no supply', async () => {
      // wallet has all measure tokens
      await measure.mint(wallet.address, toWei('100'))
      // drip tokens could have been awarded, but aren't
      await faucet.setCurrentTime(10)
      await expect(faucet.drip())
        .not.to.emit(faucet, 'Dripped')

      // *now* we have tokens
      await dripToken.mint(faucet.address, toWei('10'))

      // should be tokens minted now
      await faucet.setCurrentTime(20)
      await expect(faucet.drip())
        .to.emit(faucet, 'Dripped')
        .withArgs(toWei('1'))
    })

    it('should cap the dripped amount of tokens to the available balance of assets', async () => {
      // 10 tokens to give
      await dripToken.mint(faucet.address, toWei('10'))

      // wallet has all measure tokens
      await measure.mint(wallet.address, toWei('100'))

      // half of the drip tokens are awarded
      await faucet.setCurrentTime(50)
      await expect(faucet.drip())
        .to.emit(faucet, 'Dripped')
        .withArgs(toWei('5'))

      // wallet claims them
      await faucet.claim(wallet.address)
      expect(await dripToken.balanceOf(wallet.address)).to.equal(toWei('5'))

      // long time passes
      await faucet.setCurrentTime(150)
      // but correct amount of tokens are dripped
      await expect(faucet.drip())
        .to.emit(faucet, 'Dripped')
        .withArgs(toWei('5'))

      // wallet claims the rest
      await faucet.claim(wallet.address)
      expect(await dripToken.balanceOf(wallet.address)).to.equal(toWei('10'))
    })

    it('the drip should pause if no one holds measure tokens', async () => {
      // 10 tokens to give
      await dripToken.mint(faucet.address, toWei('10'))

      // long time passes
      await faucet.setCurrentTime(150)
      // nothing should be dripped
      await expect(faucet.drip())
        .not.to.emit(faucet, 'Dripped')

      // much later
      await faucet.setCurrentTime(200)
      // someone mints measure tokens
      await expect(
        faucet.beforeTokenMint(wallet.address, '0', measure.address, AddressZero)
      ).not.to.emit(faucet, 'Dripped')
      await measure.mint(wallet.address, toWei('10'))

      // time passes to give away half
      await faucet.setCurrentTime(250)
      await expect(
        faucet.beforeTokenTransfer(wallet.address, wallet.address, '0', measure.address)
      ).to.emit(faucet, 'Dripped')
        .withArgs(toWei('5'))

      // wallet claims its share
      await faucet.claim(wallet.address)
      expect(await dripToken.balanceOf(wallet.address)).to.equal(toWei('5'))
    })

    it('should be pausable after having dripped some', async () => {
      // 10 tokens to drip out
      await dripToken.mint(faucet.address, toWei('10'))
      // 10 tokens to measure
      await measure.mint(wallet.address, toWei('10'))

      // move forward 10 seconds so that 1 token drips
      await faucet.setCurrentTime(10)
      await expect(faucet.drip())
        .to.emit(faucet, 'Dripped')
        .withArgs(toWei('1'))

      // user can claim their 1 token
      await faucet.claim(wallet.address)
      expect(await dripToken.balanceOf(wallet.address)).to.equal(toWei('1'))

      // now have them withdraw entirely
      await measure.burn(wallet.address, toWei('10'))

      // move forward a long time
      await faucet.setCurrentTime(100)
      // nothing should be dripped
      await expect(faucet.drip())
        .not.to.emit(faucet, 'Dripped')

      // now mint more measure tokens
      await measure.mint(wallet.address, toWei('10'))

      // Move forward 10 seconds and drip 1 more
      await faucet.setCurrentTime(110)
      await expect(faucet.drip())
        .to.emit(faucet, 'Dripped')
        .withArgs(toWei('1'))

      // user can claim the second one
      await faucet.claim(wallet.address)
      expect(await dripToken.balanceOf(wallet.address)).to.equal(toWei('2'))
    })
  })

  describe('claim()', () => {
    it('should allow a longtime holder to claim their share', async () => {
      // 10 tokens to give
      await dripToken.mint(faucet.address, toWei('10'))

      // wallet has all measure tokens
      await measure.mint(wallet.address, toWei('100'))

      // long time passes
      await faucet.setCurrentTime(100)

      // all tokens are dripped
      await expect(faucet.drip())
        .to.emit(faucet, 'Dripped')
        .withArgs(toWei('10'))

      // wallet claims the rest
      await faucet.claim(wallet.address)
      expect(await dripToken.balanceOf(wallet.address)).to.equal(toWei('10'))
    })

    it('should not give any tokens to new holders', async () => {
      // 10 tokens to give
      await dripToken.mint(faucet.address, toWei('10'))

      // wallet has all of measure tokens
      await measure.mint(wallet.address, toWei('100'))

      // half time passes
      await faucet.setCurrentTime(50)

      // tokens are dripped
      await expect(faucet.drip())
        .to.emit(faucet, 'Dripped')
        .withArgs(toWei('5'))

      // wallet2 has no claim
      await faucet.claim(wallet2.address)
      expect(await dripToken.balanceOf(wallet2.address)).to.equal(toWei('0'))

      // wallet has claim on half
      await faucet.claim(wallet.address)
      expect(await dripToken.balanceOf(wallet.address)).to.equal(toWei('5'))
    })
  })

  describe('setDripRatePerSecond()', () => {
    it('should allow the owner to change the drip rate', async () => {
      await expect(faucet.setDripRatePerSecond('1'))
        .to.emit(faucet, 'DripRateChanged')
        .withArgs('1')
    })

    it('should not allow anyone else to set drip rate', async () => {
      await expect(faucet.connect(wallet2).setDripRatePerSecond('1'))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('requires that the rip rate be greater than zero', async () => {
      await expect(faucet.setDripRatePerSecond('0'))
        .to.be.revertedWith('TokenFaucet/dripRate-gt-zero')
    })
  })

  describe('deposit()', () => {
    it('should allow new assets to be deposited into the faucet', async () => {
      await dripToken.mint(wallet.address, toWei('100'))
      await dripToken.approve(faucet.address, toWei('100'))
      await expect(faucet.deposit(toWei('100')))
        .to.emit(faucet, 'Deposited')
        .withArgs(wallet.address, toWei('100'))
    })
  })

  describe('withdrawTo()', () => {
    it('should allow the owner to pull everything out if unclaimed', async () => {
      await dripToken.mint(wallet.address, toWei('100'))
      await dripToken.approve(faucet.address, toWei('100'))
      await expect(faucet.deposit(toWei('100')))
        .to.emit(faucet, 'Deposited')
        .withArgs(wallet.address, toWei('100'))

      await faucet.withdrawTo(wallet2.address, toWei('100'))

      expect(await dripToken.balanceOf(wallet2.address)).to.equal(toWei('100'))
    })

    it('should allow the owner to pull out any tokens that havent been dripped', async () => {
      await dripToken.mint(wallet.address, toWei('100'))
      await dripToken.approve(faucet.address, toWei('100'))
      await expect(faucet.deposit(toWei('100')))
        .to.emit(faucet, 'Deposited')
        .withArgs(wallet.address, toWei('100'))

      // wallet has all of measure tokens
      await measure.mint(wallet.address, toWei('100'))      
      await faucet.drip()

      // time passes, so 50*0.1 of the tokens should be dripped
      await faucet.setCurrentTime(50)
      await faucet.drip()

      expect(await faucet.totalUnclaimed()).to.equal(toWei('5'))

      // it should now allow the owner to pull out funds that have been dripped
      await expect(faucet.withdrawTo(wallet2.address, toWei('96'))).to.be.revertedWith("TokenFaucet/insufficient-funds")

      await faucet.withdrawTo(wallet2.address, toWei('95'))

      expect(await dripToken.balanceOf(wallet2.address)).to.equal(toWei('95'))
    })
  })
})
