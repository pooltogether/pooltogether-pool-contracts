import { usePlugin } from "@nomiclabs/buidler/config";

usePlugin("@nomiclabs/buidler-waffle");
usePlugin("solidity-coverage");

const enableCoverage = false

export default {
  solc: {
    version: "0.6.4",
    optimizer: {
      enabled: !enableCoverage,
      runs: 200
    },
    evmVersion: "constantinople"
  },
  paths: {
    artifacts: "./build"
  },
  gasReporter: {
    currency: 'CHF',
    gasPrice: 21,
    enabled: enableCoverage
  }
};