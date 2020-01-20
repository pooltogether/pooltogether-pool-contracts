const {
  BINANCE
} = require('./helpers/constants')

function traceProvider({ rpcUrl }) {
  const { TruffleArtifactAdapter } = require('@0x/sol-trace')
  const ProviderEngine = require('web3-provider-engine')
  const RpcSubprovider = require('web3-provider-engine/subproviders/rpc.js')
  const { RevertTraceSubprovider } = require('@0x/sol-trace')

  const projectRoot = '.';
  const solcVersion = '0.5.12';
  const artifactAdapter = new TruffleArtifactAdapter(projectRoot, solcVersion);

  const defaultFromAddress = BINANCE; // Some ethereum address with test funds
  const revertTraceSubprovider = new RevertTraceSubprovider(artifactAdapter, defaultFromAddress);

  const providerEngine = new ProviderEngine()
  providerEngine.addProvider(revertTraceSubprovider)
  providerEngine.addProvider(new RpcSubprovider({rpcUrl}))
  providerEngine.start()

  return providerEngine
}

module.exports = {
  traceProvider
}