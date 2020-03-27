import { usePlugin } from "@nomiclabs/buidler/config";

usePlugin("@nomiclabs/buidler-waffle");

export default {
  solc: {
    version: "0.6.4",
    optimizer: {
      enabled: true,
      runs: 200
    },
    evmVersion: "constantinople"
  },
  paths: {
    artifacts: "./build"
  }
};