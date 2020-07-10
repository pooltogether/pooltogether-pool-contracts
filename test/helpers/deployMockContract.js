const {Contract, ContractFactory, utils, Wallet} = require('ethers');
const DoppelgangerContract = require('../../build/DoppelgangerWithExec.json')

async function deploy(wallet) {
  const factory = new ContractFactory(DoppelgangerContract.abi, DoppelgangerContract.bytecode, wallet);
  return factory.deploy();
}

function stub(mockContract, encoder, func, params) {
  const callData = params ? func.encode(params) : func.sighash;

  return {
    returns: async (...args) => {
      const encoded = encoder.encode(func.outputs, args);
      await mockContract.__waffle__mockReturns(callData, encoded);
    },
    reverts: async () => mockContract.__waffle__mockReverts(callData),
    withArgs: (...args) => stub(mockContract, encoder, func, args)
  };
}

function createMock(abi, mockContractInstance) {
  const {functions} = new utils.Interface(abi);
  const encoder = new utils.AbiCoder();

  return Object.values(functions).reduce((acc, func) => ({
    ...acc,
    [func.name]: stub(mockContractInstance, encoder, func)
  }), {});
}

async function deployMockContract(wallet, abi) {
  console.warn(
    'deployMockContract is an experimental feature. ' +
    'Breaking changes will not result in a new major version'
  );
  const mockContractInstance = await deploy(wallet);

  const mock = createMock(abi, mockContractInstance);
  const mockedContract = new Contract(mockContractInstance.address, abi, wallet);
  mockedContract.mock = mock;

  mockedContract.staticcall = async (contract, functionName, ...params) => {
    let fn = contract.interface.functions[functionName]
    let data = fn.encode(params)
    let result
    let returnValue = await mockContractInstance.__waffle__staticcall(contract.address, data)
    result = fn.decode(returnValue);
    if (result.length == 1) {
      result = result[0]
    }
    return result
  }

  mockedContract.call = async (contract, functionName, ...params) => {
    let data = contract.interface.functions[functionName].encode(params)
    return await mockContractInstance.__waffle__call(contract.address, data)
  }

  return mockedContract
}

module.exports = {
  deployMockContract
}