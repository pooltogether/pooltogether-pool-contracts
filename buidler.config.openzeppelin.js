const networks = require('./buidler.networks')

usePlugin("@nomiclabs/buidler-etherscan");

const config = {
  solc: {
    version: "0.5.3",
    optimizer: {
      enabled: false
    },
    evmVersion: "constantinople"
  },
  paths: {
    sources: "./.contracts-openzeppelin",
    cache: "./.cache-openzeppelin",
    artifacts: "./.build-openzeppelin"
  },
  networks,
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY
  }
}

module.exports = config