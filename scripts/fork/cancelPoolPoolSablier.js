const hardhat = require('hardhat')
const chalk = require("chalk")
const { increaseTime } = require('../../test/helpers/increaseTime')
const SablierManagerAbi = require('./abis/SablierManager.json')
const SablierAbi = require('./abis/Sablier.json')

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function yellow() {
  console.log(chalk.yellow.call(chalk, ...arguments))
}

const SABLIER_STREAM_ID = 3958
const POOL_POOL_ADDRESS = '0x396b4489da692788e327e2e4b2b0459a5ef26791'
const SABLIER_ADDRESS = '0xA4fc358455Febe425536fd1878bE67FfDBDEC59a'

async function run() {
  const { ethers } = hardhat

  const timelock = await ethers.provider.getUncheckedSigner('0x42cd8312d2bce04277dd5161832460e95b24262e')
  const sablierManager = new ethers.Contract('0x0589c7a2b2acb895ff0314a394a6d991a9204444', SablierManagerAbi, timelock)
  const sablier = new ethers.Contract(SABLIER_ADDRESS, SablierAbi, timelock)

  let stream = await sablier.getStream(SABLIER_STREAM_ID)

  yellow(stream)
  
  dim(`Cancelling stream...`)

  const tx = await sablierManager.cancelSablierStream(POOL_POOL_ADDRESS)

  dim(`Cancelled.`)

  stream = await sablier.getStream(SABLIER_STREAM_ID)

  yellow({ stream })
  
}

run()
