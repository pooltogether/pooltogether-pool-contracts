const Pool = artifacts.require('Pool.sol')
const DrawManager = artifacts.require('DrawManager.sol')
const FixidityLib = artifacts.require('FixidityLib.sol')
const {
  SCD_MCD_MIGRATION_ADDRESS
} = require('./helpers/constants')

contract('Pool', (accounts) => {
  describe('scdMcdMigration()', () => {
    it('should return the right address', async () => {
      let dm = await DrawManager.new()
      let fl = await FixidityLib.new()
      Pool.link('DrawManager', dm.address)
      Pool.link('FixidityLib', fl.address)
      let pool = await Pool.new()
      assert.equal(await pool.scdMcdMigration(), SCD_MCD_MIGRATION_ADDRESS)
    })
  })
})
