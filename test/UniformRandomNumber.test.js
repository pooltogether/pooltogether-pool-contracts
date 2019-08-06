const ExposedUniformRandomNumber = artifacts.require('ExposedUniformRandomNumber.sol')

contract('ExposedUniformRandomNumber', () => {

  let random

  beforeEach(async () => {
    random = await ExposedUniformRandomNumber.new()
  })

  describe('uniform()', () => {

    it('should return 0 if the upper bound is zero', async () =>{ 
      assert.equal((await random.uniform('0', '0')).toString(), '0')
    })

    it('should skip the first X numbers that cause modulo bias', async () => {
      // If max int is 10 and our upper bound is 7, then 3 % 7 = 3.  We need to skip the first 3
      const result = await random.uniform('1', '10')

      const hash = web3.utils.toBN(web3.utils.soliditySha3('1'))

      assert.equal(result.toString(), hash.mod(web3.utils.toBN('10')))
    })
  })
})