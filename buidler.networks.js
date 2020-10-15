usePlugin('@nomiclabs/buidler-ethers')

const ethers = require('ethers')

const networks = {
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
  localhost: {
    url: 'http://127.0.0.1:8545',
    blockGasLimit: 200000000,
    allowUnlimitedContractSize: true,
    chainId: 31337
  }
}

const mnemonic = process.env.HDWALLET_MNEMONIC;

if (process.env.USE_BUIDLER_EVM_ACCOUNTS && mnemonic) {
  const buidlerEvmAccounts = []
  console.log('in there')
  for (let i = 0; i < 10; i++) {
    const wallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/" + i)
    const privateKey = wallet.privateKey

    console.log('wallet address', wallet.address)
    console.log('wallet privateKey', privateKey)

    buidlerEvmAccounts.push({
      privateKey,
      balance: '1000000000000000000000'
    })
  }

  networks.localhost = {
    accounts: {
      mnemonic
    }
  }

  networks.buidlerevm = {
    accounts: buidlerEvmAccounts
  }
} else if (process.env.INFURA_API_KEY && mnemonic) {
  networks.kovan = {
    url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
    accounts: {
      mnemonic
    }
  }

  networks.ropsten = {
    url: `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
    accounts: {
      mnemonic
    }
  }

  networks.rinkeby = {
    url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
    accounts: {
      mnemonic
    }
  }

  networks.mainnet = {
    url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
    accounts: {
      mnemonic
    }
  }
} else {
  console.warn('No infura or hdwallet provided in env')
}

module.exports = networks
