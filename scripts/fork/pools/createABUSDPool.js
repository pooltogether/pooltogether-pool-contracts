const { createAndRunYieldSourcePrizePool } = require('../helpers/createAndRunYieldSourcePrizePool')
const hardhat = require('hardhat')
const { BUSD_HOLDER } = require('../constants')
const { ethers } = hardhat

async function run() {
  const busdHolder = await ethers.provider.getUncheckedSigner(BUSD_HOLDER)
  const busdYieldSourceAddress = '0x858415FdB262F17F7a63f6B1F6fEd7AF8308A1A7'

  await createAndRunYieldSourcePrizePool(busdHolder, busdYieldSourceAddress)
}

run()
