const hardhat = require('hardhat')
const {
  DAI_HOLDER
} = require('./constants')
const { ethers } = hardhat
const { dim, green } = require('../helpers/console')

async function run() {
  const daiHolder = await ethers.provider.getUncheckedSigner(DAI_HOLDER)
  const daiYieldSourceAddress = '0x379421d1e78eb2A2245FA1E8326f794101893129'

  const dai = await ethers.getContractAt('IERC20Upgradeable', '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', daiHolder)
  const daiYieldSource = await ethers.getContractAt('IYieldSource', daiYieldSourceAddress, daiHolder)

  const amount = ethers.utils.parseEther('100')

  dim(`Approving dai spend of ${ethers.utils.formatEther(amount)} for token at address ${dai.address}...`)

  await dai.approve(daiYieldSource.address, amount)

  dim(`Supply token to yield source...`)

  dim(`Checking token...`)

  let token = await daiYieldSource.depositToken()

  green(`Deposit token is ${token}`)

  await daiYieldSource.supplyTokenTo(amount, daiHolder._address)

  green(`Done!`)

}

run()
