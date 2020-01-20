const { buildContext } = require('oz-console')
// const { traceProvider } = require('./traceProvider')
// const { ethers } = require('ethers')

async function context(verbose = false, mainnet = false) {
  // const provider = new ethers.providers.Web3Provider(traceProvider({ rpcUrl: process.env.LOCALHOST_URL }))

  let args = {
    projectConfig: '.openzeppelin/project.json',
    directory: 'build/contracts',
    verbose,
    mnemonic: process.env.HDWALLET_MNEMONIC
  }

  if (mainnet) {
    args.network = process.env.INFURA_PROVIDER_URL_MAINNET
    args.networkConfig = '.openzeppelin/mainnet.json'
  } else {
    args.network = process.env.LOCALHOST_URL
    args.networkConfig = '.openzeppelin/dev-999.json'
  }

  const result = buildContext(args)

  result.reload = () => {
    Object.assign(result, buildContext(args))
  }

  return result
}

module.exports = {
  context
}