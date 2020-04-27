import { usePlugin } from "@nomiclabs/buidler/config";

usePlugin("@nomiclabs/buidler-waffle");
usePlugin("buidler-gas-reporter");
usePlugin("solidity-coverage");

export default {
  solc: {
    version: "0.6.4",
    optimizer: {
      enabled: false,
      runs: 200
    },
    evmVersion: "constantinople"
  },
  paths: {
    artifacts: "./build"
  },
  networks: {
    coverage: {
      url: 'http://127.0.0.1:8555'
    },
    local: {
      url: 'http://127.0.0.1:8565'
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