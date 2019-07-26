'use strict';

var HDWalletProvider = require("truffle-hdwallet-provider")

module.exports = {
  networks: {
    local: {
      host: 'localhost',
      port: 8545,
      gas: 5000000,
      gasPrice: 1 * 1000000000,
      network_id: '*'
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
      gas: 5000000,
      gasPrice: 1 * 1000000000
    },

    mainnet: {
      provider: () => new HDWalletProvider(
        process.env.HDWALLET_MNEMONIC,
        process.env.INFURA_PROVIDER_URL_MAINNET,
        0,
        2
      ),
      skipDryRun: true,
      network_id: 1,
      gas: 7000000,
      gasPrice: 3 * 1000000000
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
      runs: 1
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
