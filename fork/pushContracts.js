const { runShell } = require('./runShell')

function pushContracts() {
  runShell(`oz push --network mainnet_fork --force --from ${process.env.ADMIN_ADDRESS}`)
}

module.exports = {
  pushContracts
}