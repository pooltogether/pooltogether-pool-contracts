const networks = require('./buidler.networks')

const {TASK_COMPILE_GET_COMPILER_INPUT} = require("@nomiclabs/buidler/builtin-tasks/task-names");

const RNGBlockhashRopsten = require('@pooltogether/pooltogether-rng-contracts/deployments/ropsten/RNGBlockhash.json')
const RNGBlockhashRinkeby = require('@pooltogether/pooltogether-rng-contracts/deployments/rinkeby/RNGBlockhash.json')
const RNGBlockhashKovan = require('@pooltogether/pooltogether-rng-contracts/deployments/kovan/RNGBlockhash.json')

usePlugin("@nomiclabs/buidler-waffle");
usePlugin("buidler-gas-reporter");
usePlugin("solidity-coverage");
usePlugin("@nomiclabs/buidler-etherscan");
usePlugin("buidler-deploy");

// This must occur after buidler-deploy!
task(TASK_COMPILE_GET_COMPILER_INPUT).setAction(async (_, __, runSuper) => {
  const input = await runSuper();
  input.settings.metadata.useLiteralContent = process.env.USE_LITERAL_CONTENT != 'false';
  console.log(`useLiteralContent: ${input.settings.metadata.useLiteralContent}`)
  return input;
})

const testnetAdmin = '0xE0F4217390221aF47855E094F6e112D43C8698fE' // Account 1
const testnetUser1 = '0xeedDf4937E3A7aBe03E08963C3c20affbD770b51' // Account 3
const testnetUser2 = '0xcE53382F96FdE0DB592574ed2571B3307dB859Ce' // Account 4
const testnetUser3 = '0x381843c8b4a4a0Da3C0800708c84AA2d792D22b1' // Account 5

const optimizerEnabled = !process.env.OPTIMIZER_DISABLED

const config = {
  solc: {
    version: "0.6.12",
    optimizer: {
      enabled: optimizerEnabled,
      runs: 200
    },
    evmVersion: "istanbul"
  },
  paths: {
    artifacts: "./build"
  },
  networks,
  gasReporter: {
    currency: 'CHF',
    gasPrice: 21,
    enabled: (process.env.REPORT_GAS) ? true : false
  },
  namedAccounts: {
    deployer: {
      default: 0
    },
    pool: {
      default: "0x0cEC1A9154Ff802e7934Fc916Ed7Ca50bDE6844e"
    },
    comptroller: {
      1: '0x4027dE966127af5F015Ea1cfd6293a3583892668'
    },
    reserveRegistry: {
      1: '0x3e8b9901dBFE766d3FE44B36c180A1bca2B9A295'
    },
    rng: {
      42: RNGBlockhashKovan.address,
      4: RNGBlockhashRinkeby.address,
      3: RNGBlockhashRopsten.address
    },
    adminAccount: {
      42: testnetAdmin,
      4: testnetAdmin,
      3: testnetAdmin
    },
    testnetUser1: {
      default: testnetUser1,
      3: testnetUser1,
      4: testnetUser1,
      42: testnetUser1,
    },
    testnetUser2: {
      default: testnetUser2,
      3: testnetUser2,
      4: testnetUser2,
      42: testnetUser2,
    },
    testnetUser3: {
      default: testnetUser3,
      3: testnetUser3,
      4: testnetUser3,
      42: testnetUser3,
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  mocha: {
    timeout: 30000
  }
};

module.exports = config
