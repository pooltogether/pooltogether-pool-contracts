const SortitionSumTreeFactory = artifacts.require('SortitionSumTreeFactory.sol')
const DrawManager = artifacts.require('DrawManager.sol')
const ExposedDrawManager = artifacts.require('ExposedDrawManager.sol')
const _ = require('lodash')
const toWei = require('./helpers/toWei')

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

contract('StressTest', (accounts) => {

    let drawManager

    let sumTree

    const [owner, admin, user1, user2, user3, user4, user5, user6] = accounts

    const wallet = web3.eth.accounts.wallet.create(5000)

    beforeEach(async () => {
        sumTree = await SortitionSumTreeFactory.new()
        await DrawManager.link("SortitionSumTreeFactory", sumTree.address)
        const dm = await DrawManager.new()
        await ExposedDrawManager.link("DrawManager", dm.address)
        drawManager = await ExposedDrawManager.new()
    })

    xit('should work', async () => {
      const draws = 3
      const deposits = 20

      let receipt

      for (let d = 0; d < draws; d++) {
        await drawManager.openNextDraw()
        for (let i = 0; i < deposits; i++) {
          const account = wallet[i]
          receipt = (await drawManager.deposit(account.address, toWei('10'))).receipt
          console.log(`Draw ${d}: Deposit ${i}: ${receipt.gasUsed}`)
        }

        for (let i = 0; i < deposits; i++) {
          const withdrawalIndex = deposits - 1
          receipt = (await drawManager.withdraw(wallet[withdrawalIndex].address)).receipt
          console.log(`Draw ${d}: Withdraw ${withdrawalIndex}: ${receipt.gasUsed}`)
        }
      }
    })
})
