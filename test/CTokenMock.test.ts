import { deployContract } from 'ethereum-waffle';
import { waffle } from "@nomiclabs/buidler";
import ERC20Mintable from "../build/ERC20Mintable.json";
import CTokenMock from "../build/CTokenMock.json";
import { ethers, Contract } from 'ethers'
import { expect } from 'chai'

const provider = waffle.provider;
const [wallet, otherWallet] = provider.getWallets();

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe("CTokenMock contract", function() {

    let token: Contract
    let cTokenMock: Contract

    beforeEach(async () => {
        token = await deployContract(wallet, ERC20Mintable, [])
        cTokenMock = await deployContract(wallet, CTokenMock, [])
        await cTokenMock.initialize(token.address, ethers.utils.parseEther('0.01'))
    })

    describe("mint()", function() {
        it("Should work", async function() {
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
