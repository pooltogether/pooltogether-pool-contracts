const { runShell } = require('./runShell')

async function pushContracts() {
  runShell(`oz push --network mainnet_fork --force --from ${process.env.ADMIN_ADDRESS}`)
}

module.exports = {
  pushContracts
}