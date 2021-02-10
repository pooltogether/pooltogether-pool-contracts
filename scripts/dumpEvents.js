const hardhat = require('hardhat')
const fs = require('fs')

async function run() {
  const { deployments, ethers } = hardhat
  const { provider } = ethers

  const signers = await ethers.getSigners()

  const ticket = await ethers.getContractAt('Ticket', '0x334cBb5858417Aee161B53Ee0D5349cCF54514CF', signers[0])

  const filter = ticket.filters.Transfer()

  filter.fromBlock = 11104392


  const logs = await provider.getLogs(filter)

  console.log(`Found ${logs.length} logs`)

  const events = logs.map(log => ticket.interface.parseLog(log))

  const outputFile = fs.openSync('./transfers.csv', 'w')
  events.forEach(event => {
    fs.writeSync(outputFile, `${event.args.from},${event.args.to},${event.args.value}\n`)
  })
  fs.closeSync(outputFile)
}

run()
