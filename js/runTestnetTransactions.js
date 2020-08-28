const buidler = require("@nomiclabs/buidler");

const ERC20Drippable = require('../build/ERC20Drippable.json')
const CompoundPrizePool = require('../build/CompoundPrizePool.json')
const PrizeStrategy = require('../build/PrizeStrategy.json')

const BALANCE_DRIP = {
  rinkeby: {
    source  : '0x5EbDCb616FEd3C3fb3BbaBC1aA61f8d3f26640Ca',
    measure : '0x9b39ee0289Af5C827BeF3204625425Ee4B0c7aEA',
    drip    : '0xBD71703a7857FeBa905Ef2d493E8bf6Cb8Cc1eCe',
  }
}

const VALID_CHAIN_IDS = [3, 4, 5, 42]

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

  console.log("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
  console.log("PoolTogether Pool Contracts - Testnet Transactions Script")
  console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")

  const { getNamedAccounts, deployments, getChainId, ethers } = buidler
  const { deploy, getOrNull, save, log } = deployments
  const toWei = ethers.utils.parseEther
  const toEth = ethers.utils.formatEther

  const { testnetUser1, testnetUser2, testnetUser3 } = await getNamedAccounts()
  const testnetUsers = [testnetUser1, testnetUser2, testnetUser3]
  // const signer = await ethers.provider.getSigner(deployer)
  // console.log(`Using deployer address: ${deployer}\n`)

  const chainId = parseInt(await getChainId(), 10)
  const chainName = getChainName(chainId)
  if (!VALID_CHAIN_IDS.includes(chainId) || !chainName.length) {
    throw new Error('\nInvalid network specified, aborting.\n\n')
  }
  console.log(`Using network: ${chainName}\n`)

  // Get Deployed Comptroller
  const comptrollerDeployData = require(`../deployments/${chainName}/Comptroller.json`)

  console.log(`\n  Loading Comptroller from address: "${comptrollerDeployData.address}"...`)
  const comptroller = new ethers.Contract(comptrollerDeployData.address, comptrollerDeployData.abi)

  let testnetUser
  let testnetSigner
  let response
  let sourceAddress = BALANCE_DRIP[chainName].source
  let measureTokenAddress = BALANCE_DRIP[chainName].measure
  let balanceDripTokenAddress = BALANCE_DRIP[chainName].drip

  for (let i = 0; i < testnetUsers.length; i++) {
    testnetUser = testnetUsers[i]
    testnetSigner = await ethers.provider.getSigner(testnetUser)

    console.log(`\n  Updating BalanceDrip for User ${testnetUser}...`)
    await comptroller.connect(testnetSigner)
      .updateDrips([{source: sourceAddress, measure: measureTokenAddress}], testnetUser, [balanceDripTokenAddress])

    console.log(`\n  Reading BalanceDrip for User ${testnetUser}...`)
    response = await comptroller.connect(testnetSigner)
      .callStatic
      .updateDrips([{source: sourceAddress, measure: measureTokenAddress}], testnetUser, [balanceDripTokenAddress])
    console.log(` - BalanceDrip balance: ${toEth(response[0].balance)}`)
  }

  /////////////////////////////////////
  // Script Complete
  /////////////////////////////////////

  console.log("\n  Testnet Transactions Complete!\n")
  console.log("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")
  process.exit(0)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
