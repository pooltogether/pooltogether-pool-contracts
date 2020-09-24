const buidler = require("@nomiclabs/buidler");

const ERC20Mintable = require('../build/ERC20Mintable.json')
const CompoundPrizePool = require('../build/CompoundPrizePool.json')
const SingleRandomWinner = require('../build/SingleRandomWinner.json')

const DEPLOY = {
  BALANCE_DRIPS: true,
  VOLUME_DRIPS: true,
  REF_VOLUME_DRIPS: true,
}

const PRIZE_POOLS = {
  ropsten:  ['0x529346f4242A4b55c5e964a78FaAe13f89305F4B', '0x79658471d30ce4EeE599eC0d9CE1D2038f9C3986', '0x65b0FadC562546A473b6964E9E71496544b53963', '0x62ccB9b830b87aAF5874D12646Da86C8C048482D', '0x294982ca5f5a9D120d08fdaF8281D094a9735543', '0x395E776612C950DAfF7afE391E45379dF8659931'],
  rinkeby:  ['0xcfE8B7281D2bEc8325cba02E0957FBfF4a6262f6', '0x546349619F5C229267B37996DE7146C466e7B9Cc', '0x9C877ECa3010B48e7C8A5Ff86160a9476B5d6866', '0x607d70Cd424D0522eF285F98522A3c53cB93B2a3', '0xb09D3C159066dA3c7609b08F1Bd4F4Fd046F160a', '0x3feea533B789aF732990381508AC8e4eF15098Ac'],
  kovan:    ['0xf8FF07Bfa9B1Cb327f72528B07c9008D090CEa69', '0xa81Aa0d2BB8a0AEB35b0F7360eD74f343C2b6977', '0x23F8E6b73B3183caB4495e743882598DFD5Db607', '0x61560B4007a4F12EfC128a7Adc35dEd6E50aAcf6', '0x364eF3906Cc5FbFD2eD224d6DEe286b53142cc50', '0xA8785214354EdEd1089791243207688B2F792b61'],
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
    prizeStrategy = new ethers.Contract(prizeStrategyAddress, SingleRandomWinner.abi, signer)

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
        BigInt.asUintN(32, BigInt(periodEndTime)),
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
        BigInt.asUintN(32, BigInt(periodEndTime)),
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
