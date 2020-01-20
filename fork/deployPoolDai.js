const { runShell } = require('./runShell')
const { exec } = require('./exec')
const {
  MULTISIG,
  MULTISIG_ADMIN1
} = require('./helpers/helpers/constants')
const chai = require('chai')
const expect = chai.expect

async function deployPoolDai(context) {
  // Assume contracts have already been pushed

  const owner = MULTISIG_ADMIN1
  const cToken = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643'
  const feeFraction = '0'
  const feeBeneficiary = MULTISIG
  const name = 'Pool Dai'
  const symbol = 'poolDai'

  const args = `${owner},${cToken},${feeFraction},${feeBeneficiary},"${name}","${symbol}",[],0xc73e0383f3aff3215e6f04b0331d58cecf0ab849,${context.contracts.PoolSai.address}`

  runShell(`oz create PoolDai --network mainnet_fork --from ${process.env.ADMIN_ADDRESS} --init init --args '${args}'`)
}

module.exports = {
  deployPoolDai
}