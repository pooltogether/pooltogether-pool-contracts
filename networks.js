var HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  networks: {
    kovan: {
      provider: () => new HDWalletProvider(
        process.env.HDWALLET_MNEMONIC,
        `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
        0,
        3
      ),
      networkId: 42
    },
    ropsten: {
      provider: () => new HDWalletProvider(
        process.env.HDWALLET_MNEMONIC,
        `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
        0,
        3
      ),
      networkId: 3
    },
    local: {
      host: 'localhost',
      port: process.env.LOCAL_BUIDLEREVM_PORT,
      gas: 20000000,
      gasPrice: 1 * 1000000000,
      network_id: '*'
    }
  },
};
