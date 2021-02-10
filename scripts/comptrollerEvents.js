const hardhat = require('hardhat')
const { ethers } = hardhat
const { provider, getContractAt } = ethers
const ticketHolders = require('./dai_reward_zero_balances.json')

const loadContracts = require('./loadContracts')

const SHIM = '0x2F6e61d89d43b3aDa4A909935EE05d8Ca8Db78DE'
const OLD_STRATEGY = '0xc7c406A867B324b9189b9a7503683eFC9BdCe5BA'
// const NEW_STRATEGY = '0x178969A87a78597d303C47198c66F68E8be67Dc2'  # unused
const TICKET = '0x334cbb5858417aee161b53ee0d5349ccf54514cf'
const FROM_BLOCK = 11101017
const TO_BLOCK = 'latest'

async function getComptroller() {
  const signers = await hardhat.ethers.getSigners()
  return await getContractAt('Comptroller', '0x4027dE966127af5F015Ea1cfd6293a3583892668', signers[0])
}

async function getComptrollerEvents(filter) {
  const comptroller = await getComptroller()
  const filterWithBlocks = {
    ...filter,
    fromBlock: FROM_BLOCK,
    toBlock: TO_BLOCK
  }
  const logs = await provider.getLogs(filterWithBlocks)
  const events = []
  for (var i = 0; i < logs.length; i++) {
    const log = logs[i]
    events.push({
      log,
      event: comptroller.interface.parseLog(log)
    })
  }
  return events
}

async function run () { 
  const comptroller = await getComptroller()
  const failedAddress = '0xd70804463bb2760c3384fc87bbe779e3d91bab3a'
  const workingAddress = '0xbf39e045ef6828e66dd2a30926e64b3df982c76c'

  // const addresses = [
  //   '0x690dae9338ba55bffbd6e00e77c42d4fd1e04fe9',
  //   '0x4d7fa87369413789c6dba3110a4288d97117aeb5',
  //   '0xe5e4188f3aca617ae0c40634bdf168da328a838f'
  // ]

  const addresses = ticketHolders

  // location balanceDrips[oldStrat].dripRatePerSecond
  // const { keccak256, hexlify, concat, arrayify } = ethers.utils
  // let storageLocation = ethers.BigNumber.from(keccak256(concat([hexlify(OLD_STRATEGY), 2]))).add(1)
  // console.log('Location: ', hexlify(storageLocation))
  // let storage = await provider.getStorageAt(comptroller.address, storageLocation)
  // console.log(`Storage: ${storage}`)

  let total = ethers.BigNumber.from('0')

  for (var i = 0; i < addresses.length; i++) {
    const address = addresses[i]

    const currentBalance = await comptroller.callStatic.updateDrips([[OLD_STRATEGY, TICKET], [SHIM, TICKET]], address, [TICKET])
    const balance = currentBalance[0][1]
    total = total.add(balance)
    console.log(`${i}: ${address}: balance: ${ethers.utils.formatEther(balance.toString())}, total: ${total.toString()} as ether: ${ethers.utils.formatEther(total).toString()}}`)

    // const dripTokenDrippedEvents = await getComptrollerEvents(comptroller.filters.DripTokenDripped(TICKET, address))
    // const dripTokenClaimedEvents = await getComptrollerEvents(comptroller.filters.DripTokenClaimed(null, TICKET, address))
    // const currentBalance = await comptroller.callStatic.updateDrips([[OLD_STRATEGY, TICKET], [SHIM, TICKET]], address, [TICKET])
    // console.log(`Address ${address}: DripTokenDripped: ${dripTokenDrippedEvents.length}`)
    // console.log(`Address ${address}: DripTokenClaimed: ${dripTokenClaimedEvents.length}`)
    // console.log(`Address ${address}: updateDrips: ${currentBalance}`)

    console.log(``)
  }
}

run()