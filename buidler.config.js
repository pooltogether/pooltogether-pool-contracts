const {TASK_COMPILE_GET_COMPILER_INPUT} = require("@nomiclabs/buidler/builtin-tasks/task-names");

task(TASK_COMPILE_GET_COMPILER_INPUT).setAction(async (_, __, runSuper) => {
  const input = await runSuper();
  input.settings.metadata.useLiteralContent = false;
  return input;
})

usePlugin("@nomiclabs/buidler-waffle");
usePlugin("buidler-gas-reporter");
usePlugin("solidity-coverage");
usePlugin("@nomiclabs/buidler-etherscan");

module.exports = {
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
  networks: {
    buidlerevm: {
      blockGasLimit: 200000000,
      allowUnlimitedContractSize: true
    },
    coverage: {
      url: 'http://127.0.0.1:8555',
      blockGasLimit: 200000000,
      allowUnlimitedContractSize: true
    },
    local: {
      url: 'http://127.0.0.1:' + process.env.LOCAL_BUIDLEREVM_PORT || '8545',
      blockGasLimit: 200000000,
      allowUnlimitedContractSize: true
    }
  },
  gasReporter: {
    currency: 'CHF',
    gasPrice: 21,
    enabled: (process.env.REPORT_GAS) ? true : false
  }
};
