const { deployContract } = require('ethereum-waffle')
const yVaultMock = require('../build/yVaultMock.json')
const ERC20Mintable = require('../build/ERC20Mintable.json')

const { ethers } = require('ethers')
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:yVaultMock.test')

let overrides = { gasLimit: 20000000 }

const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'

describe('yVaultMock', function() {
  let wallet, wallet2

  let erc20token, vault

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    debug(`using wallet ${wallet._address}`)

    debug('creating token...')
    erc20token = await deployContract(wallet, ERC20Mintable, ['Token', 'TOKE'], overrides)

    debug('creating vault...')
    vault = await deployContract(wallet, yVaultMock, [erc20token.address], overrides)
  })

  describe('deposit()', () => {
    it('should take tokens from the sender and mint shares', async () => {
      await erc20token.mint(wallet._address, toWei('100'))

      await erc20token.approve(vault.address, toWei('100'))

      await vault.deposit(toWei('100'))

      expect(await vault.balanceOf(wallet._address)).to.equal(toWei('100'))
      expect(await erc20token.balanceOf(vault.address)).to.equal(toWei('100'))
    })
  })

  describe('withdraw', () => {
    beforeEach(async () => {
      await erc20token.mint(wallet._address, toWei('100'))
      await erc20token.approve(vault.address, toWei('100'))
      await vault.deposit(toWei('100'))
    })

    it('should return the users deposit less reserve', async () => {
      await vault.withdraw(toWei('100'))

      expect(await erc20token.balanceOf(wallet._address)).to.equal(toWei('95'))
    })
  })

});
