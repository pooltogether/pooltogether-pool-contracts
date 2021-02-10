const hardhat = require("hardhat");

const VALID_CHAIN_IDS = [3, 4, 5, 42]

const BALANCE_DRIPS = {
  rinkeby: [
    {
      source  : '0xcdB22B1932F44FD69E8D2F3AFD68F1F3A6a90e3A',
      measure : '0x90708C61EF1b06E82c65e9F25bb2Af75bC1d6045',
      drips   : ['0xdb75B845960c835b6086db1bD3087Ea01e7D8BdE'],
    }
  ]
}

const VOLUME_DRIPS = {
  rinkeby: [
    {
      source  : '0xcdB22B1932F44FD69E8D2F3AFD68F1F3A6a90e3A',
      measure : '0x90708C61EF1b06E82c65e9F25bb2Af75bC1d6045',
      drips   : ['0xe5723dCaAD584418f2ba31678743E194E9d042d0'],
    }
  ]
}

const toWei = hardhat.ethers.utils.parseEther
const toEth = hardhat.ethers.utils.formatEther

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

const runBalanceDripTransactions = async ({chainName, comptroller, testnetUsers}) => {
  let balanceDrip
  let testnetUser
  let testnetSigner
  let response
  let i, j, k

  const balanceDrips = BALANCE_DRIPS[chainName]
  for (i = 0; i < balanceDrips.length; i++) {
    balanceDrip = balanceDrips[i]

    for (j = 0; j < testnetUsers.length; j++) {
      testnetUser = testnetUsers[j]
      testnetSigner = await hardhat.ethers.provider.getSigner(testnetUser)

      console.log(`\n  Updating BalanceDrip for User ${j+1} (${testnetUser})...`)
      await comptroller.connect(testnetSigner)
        .updateDrips([{source: balanceDrip.source, measure: balanceDrip.measure}], testnetUser, balanceDrip.drips)

      console.log(`\n  Reading BalanceDrip for User ${j+1} (${testnetUser})...`)
      response = await comptroller.connect(testnetSigner)
        .callStatic
        .updateDrips([{source: balanceDrip.source, measure: balanceDrip.measure}], testnetUser, balanceDrip.drips)
      for (k = 0; k < response.length; k++) {
        console.log(` - BalanceDrip balance: ${toEth(response[k].balance)} (dripToken: ${response[k].dripToken})`)
      }
    }
  }
}

const runVolumeDripTransactions = async ({chainName, comptroller, testnetUsers}) => {
  let volumeDrip
  let testnetUser
  let testnetSigner
  let response
  let i, j, k

  const volumeDrips = VOLUME_DRIPS[chainName]
  for (i = 0; i < volumeDrips.length; i++) {
    volumeDrip = volumeDrips[i]

    testnetUser = testnetUsers[0]
    testnetSigner = await hardhat.ethers.provider.getSigner(testnetUser)

    console.log(`\n  Getting VolumeDrips...`)
    for (k = 0; k < volumeDrip.drips.length; k++) {
      response = await comptroller.connect(testnetSigner)
        .getVolumeDrip(volumeDrip.source, volumeDrip.measure, volumeDrip.drips[k], false)
      console.log(` - VolumeDrip ${k + 1}: `)
      console.log(` --- dripToken: ${volumeDrip.drips[k]}`)
      console.log(` --- periodSeconds: ${response.periodSeconds.toString()}`)
      console.log(` --- dripAmount: ${toEth(response.dripAmount)}`)
      console.log(` --- periodCount: ${response.periodCount.toString()}`)
    }

    for (j = 0; j < testnetUsers.length; j++) {
      testnetUser = testnetUsers[j]
      testnetSigner = await hardhat.ethers.provider.getSigner(testnetUser)

      console.log(`\n  Updating VolumeDrips for User ${j+1} (${testnetUser})...`)
      await comptroller.connect(testnetSigner)
        .updateDrips([{source: volumeDrip.source, measure: volumeDrip.measure}], testnetUser, volumeDrip.drips)

      console.log(`\n  Reading VolumeDrips for User ${j+1} (${testnetUser})...`)
      response = await comptroller.connect(testnetSigner)
        .callStatic
        .updateDrips([{source: volumeDrip.source, measure: volumeDrip.measure}], testnetUser, volumeDrip.drips)
      for (k = 0; k < response.length; k++) {
        console.log(` - VolumeDrip balance: ${toEth(response[k].balance)} (dripToken: ${response[k].dripToken})`)
      }
    }
  }
}


async function main() {
  // Run with CLI flag --silent to suppress log output

  console.log("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
  console.log("PoolTogether Pool Contracts - Testnet Transactions Script")
  console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")

  const { getNamedAccounts, getChainId, ethers } = hardhat
  const { testnetUser1, testnetUser2, testnetUser3 } = await getNamedAccounts()
  const testnetUsers = [testnetUser1, testnetUser2, testnetUser3]

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

  //
  // Balance Drips
  //
  await runBalanceDripTransactions({chainName, comptroller, testnetUsers})

  //
  // Volume Drips
  //
  await runVolumeDripTransactions({chainName, comptroller, testnetUsers})


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
