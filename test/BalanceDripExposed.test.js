const { expect } = require('chai')
const hre = require('hardhat')
const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:BalanceDripExposed.test')

describe('BalanceDripExposed', function() {

  const overrides = { gasLimit: 9500000 }
  const unlimitedTokens = toWei('10000')
  let dripExposed
  let wallet, wallet2, wallet3, wallet4
  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await hre.ethers.getSigners()
    const BalanceDripExposedContract = await ethers.getContractFactory("BalanceDripExposed", wallet, overrides)
    dripExposed = await BalanceDripExposedContract.deploy()
    await dripExposed.setDripRate(toWei('0.1'))
  })

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
          wallet.address,
          toWei('10') // user has always held 10 tokens
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet.address, toWei('1'))

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
          wallet2.address,
          toWei('0') // user has always held 10 tokens
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet2.address, toWei('0'))

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
          wallet.address,
          toWei('10')
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet.address, toWei('1.5'))

      // wallet 2 had 50% of the supply for 10 seconds
      await expect(
        dripExposed.captureNewTokensForUser(
          wallet2.address,
          toWei('10')
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet2.address, toWei('0.5'))

    })
  })
});
