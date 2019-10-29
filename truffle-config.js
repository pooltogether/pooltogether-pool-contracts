'use strict';

var HDWalletProvider = require("truffle-hdwallet-provider")

module.exports = {
  networks: {
    local: {
      host: 'localhost',
      port: 8545,
      gas: 6999999,
      gasPrice: 1 * 1000000000,
      network_id: '*'
    },

    coverage: {
      host: "localhost",
      network_id: "*",
      port: 8555,         // <-- If you change this, also set the port option in .solcover.js.
      gas: 0xfffffffffff, // <-- Use this high gas value
      gasPrice: 0x01      // <-- Use this low gas price
    },

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

  compilers: {
    solc: {
      version: "0.5.10",
    }
  },

  solc: {
    optimizer: {
      enabled: true,
      runs: 100
    }
  },

  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions : {
      currency: 'USD',
      gasPrice: 10
    }
  }
};
