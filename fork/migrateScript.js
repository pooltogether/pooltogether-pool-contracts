const { migrate } = require('../scripts/migrate')

async function migrateScript(context) {
  await migrate(context, 'mainnet_fork')
}

module.exports = {
  migrateScript
}