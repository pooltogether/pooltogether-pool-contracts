const { createAndRunYieldSourcePrizePool } = require('../helpers/createAndRunYieldSourcePrizePool')
const hardhat = require('hardhat')
const { GUSD_HOLDER } = require('../constants')
const { ethers } = hardhat

async function run() {
  const gusdHolder = await ethers.provider.getUncheckedSigner(GUSD_HOLDER)
  const gusdYieldSourceAddress = '0x2bA1e000a381aD42af10C6e33aFe5994eE878D72'

  await createAndRunYieldSourcePrizePool(gusdHolder, gusdYieldSourceAddress)
}

run()
