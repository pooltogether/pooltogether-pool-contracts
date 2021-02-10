const hardhat = require("hardhat");



const DEPLOY = {
  BALANCE_DRIPS: true,
  VOLUME_DRIPS: true,
  REF_VOLUME_DRIPS: true,
}

const PRIZE_POOLS = {
  ropsten:  [''],
  rinkeby:  [''],
  kovan:    [''],
}

const timestamp = (offsetSeconds) => ((new Date()).getTime() + offsetSeconds)

const balanceDripRatePerSecond = '0.00001'
const volumeDripRatePerPeriod = '100'

const getChainName = (chainId) => {
  switch(chainId) {
    case 1: return 'mainnet';
    case 3: return 'ropsten';
    case 4: return 'rinkeby';
    case 5: return 'goerli';
    case 42: return 'kovan';
    case 31337: return 'HardhatEVM';
    default: return 'unknown';
  }
}

async function main() {
  // Run with CLI flag --silent to suppress log output


  // const ERC20Mintable = require('../build/ERC20Mintable.json')
const ERC20Mintable = await hre.artifacts.readArtifact("ERC20Mintable")

// const CompoundPrizePool = require('../build/CompoundPrizePool.json')
const CompoundPrizePool = await hre.artifacts.readArtifact("CompoundPrizePool")

const MultipleWinners = await hre.artifacts.readArtifact("MultipleWinners")
// const MultipleWinners = require('../build/MultipleWinners.json')

  console.log("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
  console.log("PoolTogether Pool Contracts - Drip Tokens Script")
  console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")

  const { getNamedAccounts, deployments, getChainId, ethers } = hardhat
  const { deploy } = deployments
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
  let volumeDripToken
  let refVolumeDripToken
  let periodSeconds
  let periodEndTime
  let isReferral
  let response
  let receipt

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
    prizeStrategy = new ethers.Contract(prizeStrategyAddress, MultipleWinners.abi, signer)

    console.log(`\n  Getting Measure-Token (Ticket) from PrizeStrategy...`)
    measureTokenAddress = (await prizeStrategy.functions.ticket())[0]
    console.log(`  - address: ${measureTokenAddress}`)


    /////////////////////////////////////
    // Balance Drips
    /////////////////////////////////////

    if (DEPLOY.BALANCE_DRIPS) {
      console.log("\n  Deploying BalanceDrip Token...")
      balanceDripToken = await deploy("BalanceDripToken", {
        contract: ERC20Mintable,
        args: [
          "Balance Drip Token",
          "BDRIP"
        ],
        from: deployer,
        skipIfAlreadyDeployed: true
      })
      console.log(`  - deployed address: ${balanceDripToken.address}`)

      console.log(`\n  Activating BalanceDrip with a Drip-Rate of ${balanceDripRatePerSecond} per second...`)
      response = await comptroller.activateBalanceDrip(prizePoolAddress, measureTokenAddress, balanceDripToken.address, toWei(balanceDripRatePerSecond))

      console.log(`\n  Minting BalanceDrip Tokens to Comptroller...`)
      balanceDripToken = new ethers.Contract(balanceDripToken.address, ERC20Mintable.abi, signer)
      await balanceDripToken.mint(comptroller.address, toWei('1000000000')) // 1 Billion
    }

    /////////////////////////////////////
    // Volume Drips
    /////////////////////////////////////

    //
    //  Non-referral volume drip
    //

    if (DEPLOY.VOLUME_DRIPS) {
      console.log("\n  Deploying VolumeDrip Token...")
      volumeDripToken = await deploy("VolumeDripToken", {
        contract: ERC20Mintable,
        args: [
          "Volume Drip Token",
          "VDRIP"
        ],
        from: deployer,
        gas: 1e9,
        skipIfAlreadyDeployed: true
      })
      console.log(`  - deployed address: ${volumeDripToken.address}`)

      isReferral = false
      periodSeconds = 900
      periodEndTime = timestamp(periodSeconds)

      console.log(`\n  Activating VolumeDrip with a Drip-Rate of ${volumeDripRatePerPeriod} per period...`)
      await comptroller.activateVolumeDrip(
        prizePoolAddress,
        measureTokenAddress,
        volumeDripToken.address,
        isReferral,
        BigInt.asUintN(32, BigInt(periodSeconds)),
        toWei(volumeDripRatePerPeriod),
        BigInt.asUintN(32, BigInt(periodEndTime))
      )

      console.log(`\n  Minting VolumeDrip Tokens to Comptroller...`)
      volumeDripToken = new ethers.Contract(volumeDripToken.address, ERC20Mintable.abi, signer)
      await volumeDripToken.mint(comptroller.address, toWei('1000000000')) // 1 Billion
    }

    //
    //  Referral volume drip
    //

    if (DEPLOY.REF_VOLUME_DRIPS) {
      console.log("\n  Deploying Referral VolumeDrip Token...")
      refVolumeDripToken = await deploy("RVolumeDripToken", {
        contract: ERC20Mintable,
        args: [
          "Referral Volume Drip Token",
          "RVDRIP"
        ],
        from: deployer,
        gas: 1e9,
        skipIfAlreadyDeployed: true
      })
      console.log(`  - deployed address: ${refVolumeDripToken.address}`)

      isReferral = true
      periodSeconds = 900
      periodEndTime = timestamp(periodSeconds)

      console.log(`\n  Activating Referral VolumeDrip with a Drip-Rate of ${volumeDripRatePerPeriod} per period...`)
      await comptroller.activateVolumeDrip(
        prizePoolAddress,
        measureTokenAddress,
        refVolumeDripToken.address,
        isReferral,
        BigInt.asUintN(32, BigInt(periodSeconds)),
        toWei(volumeDripRatePerPeriod),
        BigInt.asUintN(32, BigInt(periodEndTime))
      )

      console.log(`\n  Minting Referral VolumeDrip Tokens to Comptroller...`)
      refVolumeDripToken = new ethers.Contract(refVolumeDripToken.address, ERC20Mintable.abi, signer)
      await refVolumeDripToken.mint(comptroller.address, toWei('1000000000')) // 1 Billion
    }
  }


  /////////////////////////////////////
  // Script Complete
  /////////////////////////////////////

  console.log("\n  Drip Tokens Complete!\n")
  DEPLOY.BALANCE_DRIPS && console.log("  - Balance Drip Token: ", balanceDripToken.address)
  DEPLOY.VOLUME_DRIPS && console.log("  - Volume Drip Token: ", volumeDripToken.address)
  DEPLOY.REF_VOLUME_DRIPS && console.log("  - Referral Volume Drip Token: ", refVolumeDripToken.address)

  console.log("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")
  process.exit(0)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
