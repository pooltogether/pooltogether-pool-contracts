const buidler = require("@nomiclabs/buidler");

const ERC20Drippable = require('../build/ERC20Drippable.json')
const CompoundPrizePool = require('../build/CompoundPrizePool.json')
const PrizeStrategy = require('../build/PrizeStrategy.json')

const PRIZE_POOLS = {
  ropsten:  [''],
  rinkeby:  ['0x5EbDCb616FEd3C3fb3BbaBC1aA61f8d3f26640Ca'],
  kovan:    [''],
}

const balanceDripRate = '0.00001'

const getChainName = (chainId) => {
  switch(chainId) {
    case 1: return 'mainnet';
    case 3: return 'ropsten';
    case 4: return 'rinkeby';
    case 5: return 'goerli';
    case 42: return 'kovan';
    case 31337: return 'buidlerEVM';
    default: return 'unknown';
  }
}

async function main() {
  // Run with CLI flag --silent to suppress log output

  console.log("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
  console.log("PoolTogether Pool Contracts - Drip Tokens Script")
  console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")

  const { getNamedAccounts, deployments, getChainId, ethers } = buidler
  const { deploy, getOrNull, save, log } = deployments
  const toWei = ethers.utils.parseEther

  const { deployer } = await getNamedAccounts()
  const signer = await ethers.provider.getSigner(deployer)
  console.log(`Using deployer address: ${deployer}\n`)

  const chainId = parseInt(await getChainId(), 10)
  const chainName = getChainName(chainId)
  if (!chainName.length) {
    throw new Error('\nInvalid network specified, aborting.\n\n')
  }
  console.log(`Using network: ${chainName}\n`)

  // Get Deployed Comptroller
  const comptrollerDeployData = require(`../deployments/${chainName}/Comptroller.json`)

  console.log(`\n  Loading Comptroller from address: "${comptrollerDeployData.address}"...`)
  const comptroller = new ethers.Contract(comptrollerDeployData.address, comptrollerDeployData.abi, signer)

  let prizePool
  let prizePoolAddress
  let prizeStrategy
  let prizeStrategyAddress
  let measureTokenAddress
  let balanceDripToken

  // Iterate Prize Pools
  const prizePoolAddresses = PRIZE_POOLS[chainName]
  for (let i = 0; i < prizePoolAddresses.length; i++) {
    prizePoolAddress = prizePoolAddresses[i]

    // Ensure valid PrizePool address
    if (!prizePoolAddress.length) {
      throw new Error(`\nInvalid PrizePool Address at index ${i}, aborting.\n\n`)
    }

    console.log(`\n  Loading PrizePool from address: "${prizePoolAddress}"...`)
    prizePool = new ethers.Contract(prizePoolAddress, CompoundPrizePool.abi, signer)

    console.log(`\n  Getting PrizeStrategy address from PrizePool...`)
    prizeStrategyAddress = (await prizePool.functions.prizeStrategy())[0]

    console.log(`\n  Loading PrizeStrategy from address: "${prizeStrategyAddress}"...`)
    prizeStrategy = new ethers.Contract(prizeStrategyAddress, PrizeStrategy.abi, signer)

    console.log(`\n  Getting Measure-Token (Ticket) from PrizeStrategy...`)
    measureTokenAddress = (await prizeStrategy.functions.ticket())[0]
    console.log(`  - address: ${measureTokenAddress}`)


    /////////////////////////////////////
    // Balance Drips
    /////////////////////////////////////

    console.log("\n  Deploying BalanceDrip Token...")
    balanceDripToken = await deploy("BalanceDripToken", {
      contract: ERC20Drippable,
      args: [
        "Balance Drip Token",
        "BDRIP"
      ],
      from: deployer,
      skipIfAlreadyDeployed: true
    })
    console.log(`  - deployed address: ${balanceDripToken.address}`)

    // TODO: Check if Drip Token already added..

    console.log(`\n  Activating BalanceDrip with a Drip-Rate of ${balanceDripRate} per second...`)
    await comptroller.activateBalanceDrip(prizePoolAddress, measureTokenAddress, balanceDripToken.address, toWei(balanceDripRate))

    console.log(`\n  Minting BalanceDrip Tokens to Comptroller...`)
    await balanceDripToken.connect(deployer).mint(comptroller.address, toWei('1000000000')) // 1 Billion

    /////////////////////////////////////
    // Volume Drips
    /////////////////////////////////////

    // TODO..
  }


  /////////////////////////////////////
  // Script Complete
  /////////////////////////////////////

  console.log("\n  Drip Tokens Complete!\n")
  // log("  - Balance Drip Token:  ", balanceDripToken.address)

  console.log("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")
  process.exit(0)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
