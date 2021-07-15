const hardhat = require('hardhat')
const chalk = require("chalk")
const SablierManagerAbi = require('../abis/SablierManager.json')
const SablierAbi = require('../abis/Sablier.json')

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const { ethers } = hardhat

const timelockAddress = '0x42cd8312D2BCe04277dD5161832460e95b24262E'

const SABLIER_STREAM_ID = 3958
const POOL_POOL_ADDRESS = '0x396b4489da692788e327e2e4b2b0459a5ef26791'
const SABLIER_ADDRESS = '0xA4fc358455Febe425536fd1878bE67FfDBDEC59a'

async function run() {
  const timelock = await ethers.provider.getUncheckedSigner(timelockAddress)
  
  const { pool } = await getNamedAccounts()

  

  const sablierManager = new ethers.Contract('0x0589c7a2b2acb895ff0314a394a6d991a9204444', SablierManagerAbi, timelock)
  // const sablier = new ethers.Contract(SABLIER_ADDRESS, SablierAbi, timelock)

  const daiPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0x178969A87a78597d303C47198c66F68E8be67Dc2', timelock)

  dim(`Setting number of dai prize pool winners to 5...`)
  await daiPrizeStrategy.setNumberOfWinners(5)

  dim(`Splitting dai awards...`)
  await daiPrizeStrategy.setSplitExternalErc20Awards(true)
  const usdcPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0x3d9946190907ada8b70381b25c71eb9adf5f9b7b', timelock)

  dim(`Splitting usdc awards...`)
  await usdcPrizeStrategy.setSplitExternalErc20Awards(true)
  const compPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0x3ec4694b65e41f12d6b5d5ba7c2341f4d6859773', timelock)

  dim(`Splitting COMP awards...`)
  await compPrizeStrategy.setSplitExternalErc20Awards(true)
  const uniPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0xe8726B85236a489a8E84C56c95790d07a368f913', timelock)

  dim(`Splitting UNI awards...`)
  await uniPrizeStrategy.setSplitExternalErc20Awards(true)


  
  dim(`Cancelling stream...`)
  await sablierManager.cancelSablierStream(POOL_POOL_ADDRESS)

  // 200 POOL / week =  330687830687830 pool / second
  // existing faucet = 1157407407407407 pool / second
  // combined = 1488095238095237 pool / second
  // => increase of 1488095238095237 / 1157407407407407 = 1.2857

  // current remaining POOL = 13448 - 4158 = 9290
  // => need to add (9290 * 1.2857) - 9290 = 2654 POOL

  const poolPoolFaucet = await ethers.getContractAt('TokenFaucet', '0x30430419b86e9512E6D93Fc2b0791d98DBeb637b', timelock)
  dim(`Increasing drip rate of POOL pool...`)
  await poolPoolFaucet.setDripRatePerSecond('1488095238095237')

  const poolAmount = ethers.utils.parseEther('2654')
  const poolToken = await ethers.getContractAt('IERC20Upgradeable', pool, timelock)

  const balance = await poolToken.balanceOf(sablierManager.address)
  dim(`${ethers.utils.formatEther(balance)} remains in the SablierManager`)

  dim(`Depositing more funds into POOL pool...`)
  await poolToken.approve(poolPoolFaucet.address, poolAmount)
  await poolPoolFaucet.deposit(poolAmount)

  green(`Done!`)
}

run()
