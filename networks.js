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
  },
};
