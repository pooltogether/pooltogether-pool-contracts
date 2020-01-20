const chai = require('./helpers/chai')
const ExposedUniformRandomNumber = artifacts.require('ExposedUniformRandomNumber.sol')

contract('ExposedUniformRandomNumber', () => {

  let random

  beforeEach(async () => {
    random = await ExposedUniformRandomNumber.new()
  })

  describe('uniform()', () => {

    async function shouldSkip(num) {
      // Here we confirm that 2 is skipped
      const result = await random.uniform(num, '10')
      // result won't be num, it will be the module of the hash of num (and complete in one loop)
      const hash = web3.utils.toBN(web3.utils.soliditySha3(num))
      assert.equal(result.toString(), hash.mod(web3.utils.toBN('10')))
    }

    it('should revert if the upper bound is zero', async () =>{
      await chai.assert.isRejected(random.uniform('1234', '0'), /UniformRand\/min-bound/)
    })

    it('should skip the first X numbers that cause modulo bias', async () => {
      // If max int is 10 and our upper bound is 7, then 3 % 7 = 3.  We need to skip the first 3 numbers to make module "fair".

      // Max uint is 115792089237316195423570985008687907853269984665640564039457584007913129639935
      // Upper bound is 10
      // So -upperBound = 115792089237316195423570985008687907853269984665640564039457584007913129639935 - 10 + 1
      //    -upperBound = 115792089237316195423570985008687907853269984665640564039457584007913129639926
      // =>
      // min = -upperBound % upperBound = 6
      // So we skip values less than 6

      shouldSkip('0')
      shouldSkip('1')
      shouldSkip('2')
      shouldSkip('3')
      shouldSkip('4')
      shouldSkip('5')

      // five is okay
      result = await random.uniform('6', '10')
      assert.equal(result.toString(), '6')
    })
  })
})