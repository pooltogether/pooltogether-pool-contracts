async function balanceOf(contract, address) {
  let fxn = contract.interface.functions.balanceOf
  let call = fxn.encode([address])
  let result = await contract.provider.call({ to: contract.address, data: call })
  let ret = fxn.decode(result)
  return ret[0]
}

module.exports = { balanceOf }