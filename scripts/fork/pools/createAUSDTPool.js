const { createAndRunYieldSourcePrizePool } = require('../helpers/createAndRunYieldSourcePrizePool')
const hardhat = require('hardhat')
const { USDT_HOLDER } = require('../constants')
const { ethers } = hardhat

async function run() {
  const usdtHolder = await ethers.provider.getUncheckedSigner(USDT_HOLDER)
  const usdtYieldSourceAddress = '0x6E159B199423383572B7CB05FBbD54103A827F2b'

  await createAndRunYieldSourcePrizePool(usdtHolder, usdtYieldSourceAddress)
}

run()
