const Pool = artifacts.require('Pool.sol')
const DrawManager = artifacts.require('DrawManager.sol')
const FixidityLib = artifacts.require('FixidityLib.sol')
const Blocklock = artifacts.require('Blocklock.sol')
const {
  SCD_MCD_MIGRATION_ADDRESS,
  SAI_POOL_ADDRESS
} = require('./helpers/constants')

contract('Pool', (accounts) => {
  let pool

  beforeEach(async () => {
    let dm = await DrawManager.new()
    let fl = await FixidityLib.new()
    let bl = await Blocklock.new()
    Pool.link('DrawManager', dm.address)
    Pool.link('FixidityLib', fl.address)
    Pool.link('Blocklock', bl.address)
    pool = await Pool.new()
  })

  describe('scdMcdMigration()', () => {
    it('should return the right address', async () => {
      assert.equal(await pool.scdMcdMigration(), SCD_MCD_MIGRATION_ADDRESS)
    })
  })

  describe('saiPool()', () => {
    it('should return the correct address', async () => {
      assert.equal(await pool.saiPool(), SAI_POOL_ADDRESS)
    })
  })
})
