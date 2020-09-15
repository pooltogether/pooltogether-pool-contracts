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
  input.settings.metadata.useLiteralContent = false;
  return input;
})

const testnetAdmin = '0x11BA3d40F7549485D5B821217E3f4474Ae90FeCd' // Account 1
const testnetUser1 = '0x573bd3868b7672332c4D22076f55Cb0b597eb5Fd' // Account 3
const testnetUser2 = '0x7Cfc5a12506d92F29D52EC7B8d1148f46e9296ED' // Account 4
const testnetUser3 = '0x50D6d6195b102f9b58A29a57E3D71822881033a5' // Account 5

const config = {
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
      allowUnlimitedContractSize: true,
      chainId: 31337
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
  },
  namedAccounts: {
    deployer: {
      default: 0
    },
    trustedForwarder: {
      42: '0x6453D37248Ab2C16eBd1A8f782a2CBC65860E60B',
      4: '0xd6cC1FEAB6E1DbDc3c0a6F2798c8089c72F78E64',
      3: '0xcC87aa60a6457D9606995C4E7E9c38A2b627Da88'
    },
    rng: {
      42: RNGBlockhashKovan.address,
      4: RNGBlockhashRinkeby.address,
      3: RNGBlockhashRopsten.address
    },
    adminAccount: {
      default: testnetAdmin,
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
  }
};

if (process.env.INFURA_API_KEY && process.env.HDWALLET_MNEMONIC) {
  config.networks.kovan = {
    url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
    accounts: {
      mnemonic: process.env.HDWALLET_MNEMONIC
    }
  }

  config.networks.ropsten = {
    url: `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
    accounts: {
      mnemonic: process.env.HDWALLET_MNEMONIC
    }
  }

  config.networks.rinkeby = {
    url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
    accounts: {
      mnemonic: process.env.HDWALLET_MNEMONIC
    }
  }
} else {
  console.warn('No infura or hdwallet available for testnets')
}

module.exports = config