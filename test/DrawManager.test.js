const SortitionSumTreeFactory = artifacts.require('SortitionSumTreeFactory.sol')
const DrawManager = artifacts.require('DrawManager.sol')
const ExposedDrawManager = artifacts.require('ExposedDrawManager.sol')
const toWei = require('./helpers/toWei')

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
            assert.equal(await drawManager.currentDrawIndex(), '0')
            await drawManager.openNextDraw()
            assert.equal(await drawManager.currentDrawIndex(), '1')
        })

        describe('when there is an existing draw', () => {
            beforeEach(async () => {
                await drawManager.openNextDraw()
            })

            it('should create the next draw', async () => {
                await drawManager.openNextDraw()
                assert.equal(await drawManager.currentDrawIndex(), '2')
            })
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
                assert.equal(await drawManager.eligibleBalanceOf(user1), toWei('0'))

                // try it a second time
                await drawManager.deposit(user1, toWei('10'))
                assert.equal(await drawManager.firstDrawIndex(user1), '1')
                assert.equal(await drawManager.openBalanceOf(user1), toWei('20'))
                assert.equal(await drawManager.eligibleBalanceOf(user1), toWei('0'))
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
                    assert.equal(await drawManager.eligibleBalanceOf(user1), toWei('0'))
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
                        assert.equal(await drawManager.eligibleBalanceOf(user1), toWei('10'))
                        assert.equal(await drawManager.eligibleSupply(), toWei('10'))
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
                            assert.equal(await drawManager.eligibleBalanceOf(user1), toWei('20'))
                            assert.equal(await drawManager.eligibleSupply(), toWei('20'))
                        })
                    })
                })
            })
        })
    })

    describe('withdraw', () => {
        beforeEach(async () => {
            await drawManager.openNextDraw()
            await drawManager.deposit(user1, toWei('10'))
        })

        it('should allow the user to withdraw their open tokens', async () => {
            await drawManager.withdraw(user1, toWei('10'))

            assert.equal(await drawManager.openBalanceOf(user1), '0')
            assert.equal(await drawManager.eligibleBalanceOf(user1), '0')
        })

        describe('when both open and eligible balances', () => {

            beforeEach(async () => {
                await drawManager.openNextDraw()
                await drawManager.deposit(user1, toWei('10'))
            })

            it('should allow the user to withdraw their open tokens', async () => {
                await drawManager.withdraw(user1, toWei('10'))
                assert.equal(await drawManager.openBalanceOf(user1), toWei('0'))
                assert.equal(await drawManager.eligibleBalanceOf(user1), toWei('10'))
                assert.equal((await drawManager.balanceOf(user1)).toString(), toWei('10'))
            })  

            it('should allow the user to withdraw all of their tokens', async () => {
                await drawManager.withdraw(user1, toWei('20'))
                assert.equal(await drawManager.openBalanceOf(user1), toWei('0'))
                assert.equal(await drawManager.eligibleBalanceOf(user1), toWei('0'))
            })
        })
    })


    describe('draw', () => {
        it('should fail if no eligible deposits', async () => {
            let fail = true
            try {
                await drawManager.draw(0)
                fail = false
            } catch (e) {}
            assert.ok(fail)
        })

        describe('with open deposits', () => {
            beforeEach(async () => {
                await drawManager.openNextDraw()
                await drawManager.deposit(user1, toWei('10'))
                await drawManager.deposit(user2, toWei('10'))
                await drawManager.deposit(user3, toWei('10'))
            })

            it('should fail', async () => {
                let fail = true
                try {
                    await drawManager.draw(0)
                    fail = false
                } catch (e) {}
                assert.ok(fail)
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

                describe('and one withdraws', async () => { 
                    beforeEach(async () => {
                        await drawManager.withdraw(user2, toWei('10'))
                        assert.equal(await drawManager.eligibleSupply(), toWei('20'))
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
                        assert.equal(await drawManager.eligibleSupply(), toWei('60'))
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
})
