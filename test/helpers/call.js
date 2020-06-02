async function call(contract, functionName, ...args) {
  let fxn = contract.interface.functions[functionName]
  let call = fxn.encode(args)
  let result = await contract.provider.call({ to: contract.address, data: call })
  let ret = fxn.decode(result)
  return ret[0]
}

module.exports = { call }