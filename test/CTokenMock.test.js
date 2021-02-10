const { ethers } = require('ethers')
const { expect } = require('chai')
const hardhat = require('hardhat')

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('CTokenMock contract', function() {

    let token
    let cTokenMock

    let wallet
    let otherWallet

    beforeEach(async () => {
        [wallet, otherWallet] = await hardhat.ethers.getSigners()
        const ERC20Mintable = await hre.ethers.getContractFactory("ERC20Mintable", wallet)
        token = await ERC20Mintable.deploy('Test Token', 'TEST')
        const CTokenMockContract = await hre.ethers.getContractFactory("CTokenMock", wallet)
        cTokenMock = await CTokenMockContract.deploy(token.address, ethers.utils.parseEther('0.01'))
    })

    describe('mint()', function() {
        it('Should work', async function() {
            // mint a bunch of tokens to the wallet and deposit
            await token.mint(wallet.address, '1000')
            await token.approve(cTokenMock.address, '100')
            await cTokenMock.mint('100')

            expect(await cTokenMock.balanceOf(wallet.address)).to.equal('100')
            expect(await cTokenMock.balanceOfUnderlying(wallet.address)).to.equal('100')
        });

        it('should work twice', async () => {
            await token.mint(wallet.address, '1000')

            await token.approve(cTokenMock.address, '100')
            await cTokenMock.mint('100')

            await token.approve(cTokenMock.address, '300')
            await cTokenMock.mint('300')

            expect(await cTokenMock.balanceOf(wallet.address)).to.equal('400')
            expect(await cTokenMock.balanceOfUnderlying(wallet.address)).to.equal('400')
        })

        it('should ensure that a user owns the interest', async () => {
            await token.mint(wallet.address, '1000')

            await token.approve(cTokenMock.address, '100')
            await cTokenMock.mint('100')

            await cTokenMock.accrueCustom('100')

            expect(await cTokenMock.balanceOfUnderlying(wallet.address)).to.equal('200')
            expect(await cTokenMock.exchangeRateCurrent()).to.equal('2000000000000000000')
        })
    });
});
