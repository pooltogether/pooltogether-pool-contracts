const { createAndRunYieldSourcePrizePool } = require('../helpers/createAndRunYieldSourcePrizePool')
const hardhat = require('hardhat')
const { SUSHI_HOLDER } = require('../constants')
const { ethers } = hardhat

async function run() {
  const sushiHolder = await ethers.provider.getUncheckedSigner(SUSHI_HOLDER)
  const sushiYieldSourceAddress = '0xB2Ad5F4277fcaBd1CADe34317db8c5Ba478aDDAd'

  await createAndRunYieldSourcePrizePool(sushiHolder, sushiYieldSourceAddress)
}

run()
