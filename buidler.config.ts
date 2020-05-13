import { usePlugin } from "@nomiclabs/buidler/config";

usePlugin("@nomiclabs/buidler-waffle");
usePlugin("buidler-gas-reporter");
usePlugin("solidity-coverage");
usePlugin("@nomiclabs/buidler-etherscan");

export default {
  solc: {
    version: "0.6.4",
    optimizer: {
      enabled: true,
      runs: 200
    },
    evmVersion: "istanbul"
  },
  paths: {
    artifacts: "./build"
  },
  etherscan: {
    // The url for the Etherscan API you want to use.
    // For example, here we're using the one for the Ropsten test network
    url: process.env.ETHERSCAN_API_URL,
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  networks: {
    buidlerevm: {
      blockGasLimit: 200000000,
      gas: 200000000,
      allowUnlimitedContractSize: true
    },
    coverage: {
      url: 'http://127.0.0.1:8555',
      gas: 200000000
    },
    local: {
      url: 'http://127.0.0.1:' + process.env.LOCAL_BUIDLEREVM_PORT,
      gas: 200000000,
      blockGasLimit: 200000000
    },
    kovan: {
      accounts: {
        mnemonic: process.env.HDWALLET_MNEMONIC
      },
      url: process.env.INFURA_PROVIDER_URL_KOVAN,
      chainId: 42
    },
  },
  gasReporter: {
    currency: 'CHF',
    gasPrice: 21,
    enabled: (process.env.REPORT_GAS) ? true : false
  }
};
