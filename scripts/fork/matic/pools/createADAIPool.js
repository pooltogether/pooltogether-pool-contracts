const { createAndRunYieldSourcePrizePool } = require('../../helpers/createAndRunYieldSourcePrizePool')
const hardhat = require('hardhat')
const {
  DAI_HOLDER
} = require('../constants')
const { ethers } = hardhat

async function run() {
  const daiHolder = await ethers.provider.getUncheckedSigner(DAI_HOLDER)
  const daiYieldSourceAddress = '0x379421d1e78eb2A2245FA1E8326f794101893129'

  await createAndRunYieldSourcePrizePool(daiHolder, daiYieldSourceAddress)
}

run()
