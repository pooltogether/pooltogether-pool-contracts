'use strict';

var HDWalletProvider = require("truffle-hdwallet-provider")

const isCoverage = process.env.COVERAGE === 'true'

module.exports = {
  networks: {
    local: {
      host: 'localhost',
      port: 8545,
      gas: 6999999,
      gasPrice: 1 * 1000000000,
      network_id: '*'
    },

    // test: {
    //   host: 'localhost',
    //   port: 8545,
    //   gas: 10000000,
    //   gasPrice: 1 * 1000000000,
    //   network_id: 1234
    // },

    rinkeby: {
      provider: () => new HDWalletProvider(
        process.env.HDWALLET_MNEMONIC,
        process.env.INFURA_PROVIDER_URL,
        0, // we start with address[0]
        8 // notice that we unlock eight: which will be address[0] and address[1]
      ),
      skipDryRun: true,
      network_id: 4,
      gas: 6980000,
      gasPrice: 2.001 * 1000000000
    },

    mainnet: {
      provider: () => new HDWalletProvider(
        process.env.HDWALLET_MNEMONIC,
        process.env.INFURA_PROVIDER_URL_MAINNET,
        0,
        3
      ),
      skipDryRun: true,
      network_id: 1,
      // gas: 1000000,
      // gasPrice: 11.101 * 1000000000
    }
  },

  plugins: ["solidity-coverage"],

  compilers: {
    solc: {
      version: "0.5.12",
    }
  },

  // optimization breaks code coverage
  solc: isCoverage ? {} : {
    optimizer: {
      enabled: true,
      runs: 100
    }
  },

  mocha: isCoverage ? {
    reporter: 'mocha-junit-reporter',
  } : {
    reporter: 'eth-gas-reporter',
    reporterOptions : {
      currency: 'USD',
      gasPrice: 10
    }
  }
};
