const { buildContext } = require('oz-console')
// const { traceProvider } = require('./traceProvider')
// const { ethers } = require('ethers')

async function context(verbose = false) {
  // const provider = new ethers.providers.Web3Provider(traceProvider({ rpcUrl: process.env.LOCALHOST_URL }))

  const args = {
    projectConfig: '.openzeppelin/project.json',
    network: process.env.LOCALHOST_URL,
    networkConfig: '.openzeppelin/dev-999.json',
    directory: 'build/contracts',
    verbose
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