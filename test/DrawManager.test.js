const SortitionSumTreeFactory = artifacts.require('SortitionSumTreeFactory.sol')
const DrawManager = artifacts.require('DrawManager.sol')
const ExposedDrawManager = artifacts.require('ExposedDrawManager.sol')
const toWei = require('./helpers/toWei')

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

contract('DrawManager', (accounts) => {

    let drawManager

    let sumTree

    let owner, admin, user1, user2, user3, user4, user5, user6

    beforeEach(async () => {
        [owner, admin, user1, user2, user3, user4, user5, user6] = accounts
        sumTree = await SortitionSumTreeFactory.new()
        await DrawManager.link("SortitionSumTreeFactory", sumTree.address)
        const dm = await DrawManager.new()
        await ExposedDrawManager.link("DrawManager", dm.address)
        drawManager = await ExposedDrawManager.new()
    })

    describe('openNextDraw()', () => {
        it('should create a draw when none is available', async () => {
            assert.equal(await drawManager.openDrawIndex(), '0')
            await drawManager.openNextDraw()
            assert.equal(await drawManager.openDrawIndex(), '1')
        })

        describe('when there is an existing draw', () => {
            beforeEach(async () => {
                await drawManager.openNextDraw()
            })

            it('should create the next draw', async () => {
                await drawManager.openNextDraw()
                assert.equal(await drawManager.openDrawIndex(), '2')
            })
        })
    })

    describe('openSupply()', () => {
        it('should return 0 if no draw exists', async () => {
            assert.equal((await drawManager.openSupply()).toString(), '0')
        })
    })

    describe('deposit', () => {
        it('should fail if there is no current draw', async () => {
            let failed = true
            try {
                await drawManager.deposit(user1, toWei('10'))
                failed = false
            } catch (e) {
            }
            assert.ok(failed)
        })

        describe('when a draw has been opened', () => {
            beforeEach(async () => {
                await drawManager.openNextDraw()
            })

            it('should deposit the tokens as open tokens', async () => {
                await drawManager.deposit(user1, toWei('10'))
                assert.equal(await drawManager.firstDrawIndex(user1), '1')
                assert.equal(await drawManager.openBalanceOf(user1), toWei('10'))
                assert.equal(await drawManager.committedBalanceOf(user1), toWei('0'))

                // try it a second time
                await drawManager.deposit(user1, toWei('10'))
                assert.equal(await drawManager.firstDrawIndex(user1), '1')
                assert.equal(await drawManager.openBalanceOf(user1), toWei('20'))
                assert.equal(await drawManager.committedBalanceOf(user1), toWei('0'))
            })

            describe('when the user has already deposited', () => {
                beforeEach(async () => {
                    await drawManager.deposit(user1, toWei('10'))
                })

                it('should allow them to deposit again', async () => {
                    await drawManager.deposit(user1, toWei('10'))

                    assert.equal(await drawManager.firstDrawIndex(user1), '1')
                    assert.equal(await drawManager.openBalanceOf(user1), toWei('20'))
                    assert.equal(await drawManager.openSupply(), toWei('20'))
                    assert.equal(await drawManager.committedBalanceOf(user1), toWei('0'))
                })

                describe('and a second draw has been opened', () => {
                    beforeEach(async () => {
                        await drawManager.openNextDraw()
                    })

                    it('should make the previous balance eligibile and start a new open balance', async () => {
                        await drawManager.deposit(user1, toWei('10'))

                        assert.equal(await drawManager.firstDrawIndex(user1), '1')
                        assert.equal(await drawManager.secondDrawIndex(user1), '2')
                        assert.equal(await drawManager.openBalanceOf(user1), toWei('10'))
                        assert.equal(await drawManager.openSupply(), toWei('10'))
                        assert.equal(await drawManager.committedBalanceOf(user1), toWei('10'))
                        assert.equal(await drawManager.committedSupply(), toWei('10'))
                    })

                    describe('and the user has deposited, and there is a third open', () => {
                        beforeEach(async () => {
                            await drawManager.deposit(user1, toWei('10'))
                            await drawManager.openNextDraw()
                        })

                        it('should collapse the previous two draws and update the open draw', async () => {
                            await drawManager.deposit(user1, toWei('10'))

                            assert.equal(await drawManager.firstDrawIndex(user1), '1')
                            assert.equal(await drawManager.secondDrawIndex(user1), '3')
                            assert.equal(await drawManager.openBalanceOf(user1), toWei('10'))
                            assert.equal(await drawManager.openSupply(), toWei('10'))
                            assert.equal(await drawManager.committedBalanceOf(user1), toWei('20'))
                            assert.equal(await drawManager.committedSupply(), toWei('20'))
                        })
                    })
                })
            })
        })
    })

    describe('openBalanceOf()', () => {
        it('should return 0 when no draw exists', async () => {
            assert.equal((await drawManager.openBalanceOf(user1)).toString(), toWei('0'))
        })

        describe('when an open draw exists', () => {
            beforeEach(async () => {
                await drawManager.openNextDraw()
                await drawManager.deposit(user1, toWei('10'))
            })

            it('should return the open balance of the user', async () => {
                assert.equal((await drawManager.openBalanceOf(user1)).toString(), toWei('10'))
            })
        })

        describe('when an open draw has passed', () => {
            beforeEach(async () => {
                await drawManager.openNextDraw()
                await drawManager.deposit(user1, toWei('10'))
                await drawManager.openNextDraw()
                await drawManager.deposit(user1, toWei('15'))
            })

            it('should reflect the current open draw only', async () => {
                assert.equal((await drawManager.openBalanceOf(user1)).toString(), toWei('15'))
            })
        })
    })

    describe('withdraw', () => {
        beforeEach(async () => {
            await drawManager.openNextDraw()
            await drawManager.deposit(user1, toWei('10'))
            assert.equal(await drawManager.openBalanceOf(user1), toWei('10'))
        })

        it('should allow the user to withdraw their open tokens', async () => {
            await drawManager.withdraw(user1)

            assert.equal(await drawManager.openBalanceOf(user1), '0')
        })

        describe('when both open and eligible balances', () => {
            beforeEach(async () => {
                await drawManager.openNextDraw()
                await drawManager.deposit(user1, toWei('10'))
            })

            it('should allow the user to withdraw all of their tokens', async () => {
                await drawManager.withdraw(user1)
                assert.equal((await drawManager.openBalanceOf(user1)).toString(), toWei('0'))
                assert.equal((await drawManager.committedBalanceOf(user1)).toString(), toWei('0'))
            })
        })
    })


    describe('draw', () => {
        it('should return address(0) if no eligible deposits', async () => {
            assert.equal(await drawManager.draw(0), ZERO_ADDRESS)
        })

        describe('with open deposits', () => {
            beforeEach(async () => {
                await drawManager.openNextDraw()
                await drawManager.deposit(user1, toWei('10'))
                await drawManager.deposit(user2, toWei('10'))
                await drawManager.deposit(user3, toWei('10'))
            })

            it('should return 0', async () => {
                assert.equal(await drawManager.draw(0), ZERO_ADDRESS)
            })

            describe('and they become eligible', async () => {
                beforeEach(async () => {
                    await drawManager.openNextDraw()
                })

                it('should work', async () => {
                    assert.equal(await drawManager.draw(toWei('1')), user1)
                    assert.equal(await drawManager.draw(toWei('11')), user2)
                    assert.equal(await drawManager.draw(toWei('21')), user3)
                })

                describe('drawWithEntropy()', () => {
                    it('should work', async () => {
                        const address = await drawManager.drawWithEntropy('0x12431')
                        assert.ok([user1, user2, user3].indexOf(address) != -1)
                    })
                })

                describe('and one withdraws', async () => { 
                    beforeEach(async () => {
                        await drawManager.withdraw(user2)
                        assert.equal(await drawManager.committedSupply(), toWei('20'))
                    })

                    it('should fail with the previous total', async () => {
                        let fail = true
                        try {
                            await drawManager.draw(toWei('21'))
                            fail = false
                        } catch (e) {}
                        assert.ok(fail)
                    })

                    it('should read the original depositers', async () => {
                        assert.equal(await drawManager.draw(toWei('1')), user1)
                        assert.equal(await drawManager.draw(toWei('11')), user3)                        
                    })
                })

                describe('and there is a second round of deposits', () => {
                    beforeEach(async () => {
                        await drawManager.deposit(user4, toWei('10'))
                        await drawManager.deposit(user5, toWei('10'))
                        await drawManager.deposit(user6, toWei('10'))
                        await drawManager.openNextDraw()
                        await drawManager.deposit(user1, toWei('10'))
                    })

                    it('should draw from them all', async () => {
                        assert.equal(await drawManager.draw(toWei('1')), user1)
                        assert.equal(await drawManager.draw(toWei('11')), user2)
                        assert.equal(await drawManager.draw(toWei('21')), user3)
                        assert.equal(await drawManager.draw(toWei('31')), user4)
                        assert.equal(await drawManager.draw(toWei('41')), user5)
                        assert.equal(await drawManager.draw(toWei('51')), user6)
                    })

                    it('should fail with an invalid token', async () => {
                        assert.equal(await drawManager.committedSupply(), toWei('60'))
                        assert.equal(await drawManager.openSupply(), toWei('10'))
                        let fail = true
                        try {
                            await drawManager.draw(toWei('60'))
                            fail = false
                        } catch (e) {}
                        assert.ok(fail)
                    })
                })
            })
        })
    })

    describe('drawWithEntropy()', () => {
        it('should return the 0 address if no entries', async () => {
            const address = await drawManager.drawWithEntropy('0x12431')
            assert.equal(address, ZERO_ADDRESS)
        })
    })
})
