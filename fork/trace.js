const chalk = require('chalk')

async function trace(context, hash) {
  console.log(chalk.yellow(`Starting trace for ${hash}...`))
  const {
    provider
  } = context

  const result = await provider.send("debug_traceTransaction", [hash, {}])

  console.log(result)

  console.log(chalk.green(`Done trace for ${hash}.`))
}

module.exports = {
  trace
}