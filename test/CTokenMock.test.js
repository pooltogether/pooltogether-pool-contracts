const { deployContract } = require('ethereum-waffle')
const ERC20Mintable = require('../build/ERC20Mintable.json')
const CTokenMock = require('../build/CTokenMock.json')
const { ethers } = require('./helpers/ethers')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('CTokenMock contract', function() {

    let token
    let cTokenMock

    let wallet
    let otherWallet

    beforeEach(async () => {
        [wallet, otherWallet] = await buidler.ethers.getSigners()

        token = await deployContract(wallet, ERC20Mintable, [])
        cTokenMock = await deployContract(wallet, CTokenMock, [
            token.address, ethers.utils.parseEther('0.01')
        ])
    })

    describe('mint()', function() {
        it('Should work', async function() {
            // mint a bunch of tokens to the wallet and deposit
            await token.mint(wallet._address, '1000')
            await token.approve(cTokenMock.address, '100')
            await cTokenMock.mint('100')

            expect(await cTokenMock.balanceOf(wallet._address)).to.equal('100')
            expect(await cTokenMock.balanceOfUnderlying(wallet._address)).to.equal('100')
        });

        it('should work twice', async () => {
            await token.mint(wallet._address, '1000')

            await token.approve(cTokenMock.address, '100')
            await cTokenMock.mint('100')

            await token.approve(cTokenMock.address, '300')
            await cTokenMock.mint('300')

            expect(await cTokenMock.balanceOf(wallet._address)).to.equal('400')
            expect(await cTokenMock.balanceOfUnderlying(wallet._address)).to.equal('400')
        })

        it('should ensure that a user owns the interest', async () => {
            await token.mint(wallet._address, '1000')

            await token.approve(cTokenMock.address, '100')
            await cTokenMock.mint('100')

            await cTokenMock.accrueCustom('100')

            expect(await cTokenMock.balanceOfUnderlying(wallet._address)).to.equal('200')
            expect(await cTokenMock.exchangeRateCurrent()).to.equal('2000000000000000000')
        })
    });
});
