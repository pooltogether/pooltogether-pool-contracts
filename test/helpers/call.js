async function call(contract, functionName, ...args) {
  return await contract.callStatic[functionName](...args)
}

module.exports = { call }