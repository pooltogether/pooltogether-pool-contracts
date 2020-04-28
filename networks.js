var HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  networks: {
    kovan: {
      provider: () => new HDWalletProvider(
        process.env.HDWALLET_MNEMONIC,
        process.env.INFURA_PROVIDER_URL_KOVAN,
        0,
        3
      ),
      networkId: 42
    },
    local: {
      host: 'localhost',
      port: 8565,
      gas: 20000000,
      gasPrice: 1 * 1000000000,
      network_id: '*'
    }
  },
};
