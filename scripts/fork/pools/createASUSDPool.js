const { createAndRunYieldSourcePrizePool } = require('../helpers/createAndRunYieldSourcePrizePool')
const hardhat = require('hardhat')
const { SUSD_HOLDER } = require('../constants')
const { ethers } = hardhat

async function run() {
  const susdHolder = await ethers.provider.getUncheckedSigner(SUSD_HOLDER)
  const susdYieldSourceAddress = '0x4C8D99B0c7022923ef1A81ADb4E4e326f8E91ac9'

  await createAndRunYieldSourcePrizePool(susdHolder, susdYieldSourceAddress)
}

run()
