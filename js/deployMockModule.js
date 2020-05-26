const { deployMockContract } = require('ethereum-waffle')
const {
  ACCEPT_MAGIC
} = require('./constants')

let overrides = { gasLimit: 20000000 }

async function deployMockModule(wallet, moduleManagerHarness, abi, interfaceHash) {
  let module = await deployMockContract(wallet, abi, overrides)
  await module.mock.canImplementInterfaceForAddress.returns(ACCEPT_MAGIC)
  await moduleManagerHarness.register(interfaceHash, module.address)
  return module
}

module.exports = {
  deployMockModule
}