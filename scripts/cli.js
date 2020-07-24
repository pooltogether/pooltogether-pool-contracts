#!/usr/bin/env node
const commander = require('commander');
const chalk = require('chalk')
const { Project } = require('@pooltogether/oz-migrate')
const { runShell } = require('./runShell')
const { deploy1820 } = require('deploy-eip-1820')

const { buildContext } = require('oz-console')

const program = new commander.Command()
program.description('Deploys the PoolTogether smart contracts')
program.option('-n --network [network]', 'configure OpenZeppelin network', 'kovan')
program.option('-a --address [address]', 'configures the address to deploy from', process.env.ADMIN_ADDRESS)
program.option('-v --verbose', 'adds verbosity', () => true)

program
  .command('migrate')
  .action(async () => {
    console.log(chalk.dim(`Starting deployment to ${program.network}....`))

    let context = await buildContext({ network: program.network, address: program.address })

    const project = new Project('.oz-migrate')
    const migration = await project.migrationForNetwork(context.networkConfig.network)

    runShell(`oz session --network ${program.network} --from ${program.address} --expires 3600 --timeout 600 --blockTimeout 50`)

    let flags = '-s'
    if (program.verbose) {
      flags = '-v'
    }

    await migration.migrate(2, async () => {
      if (program.network == 'local') {
        console.log(chalk.dim('Deploying ERC1820 Registry...'))
        await deploy1820(context.signer)
      }
    })

    await migration.migrate(5, async () => {
      if (program.network == 'local') {
        runShell(`oz deploy -n ${program.network} -k regular Forwarder`)
      }
    })

    await migration.migrate(7, async () => {
      if (program.network == 'local') {
        runShell(`oz deploy -n ${program.network} -k regular MockGovernor`)
      }
    })

    await migration.migrate(8, async () => {
      if (program.network == 'local') {
        runShell(`oz deploy -n ${program.network} -k regular RNGServiceMock`)
      }
    })

    let trustedForwarder, governor, rng
    if (program.network == 'kovan') {
      trustedForwarder = '0x6453D37248Ab2C16eBd1A8f782a2CBC65860E60B'
      governor = '0x2f935900D89b0815256a3f2c4c69e1a0230b5860'
      rng = '0x9843BE095a3B8cAF41D4B2266b5489B08ED902b0' // RNGVeeDo connected to Mock Beacon @ 0xAF4be1011af30a7D77bf74Dee1a719186F1E4EB3
    } else if (program.network == 'ropsten') {
      trustedForwarder = '0xcC87aa60a6457D9606995C4E7E9c38A2b627Da88'
      governor = '0xD215CF8D8bC151414A9c5c145fE219E746E5cE80'
      rng = '0x976D4481dB98FC5140eDC3B382F043419813c351' // RNGVeeDo connected to Mock Beacon @ 0xfd480d2b719e28B3B76c8e06B66BA774703628BA
    } else {
      context = await buildContext({ network: program.network, address: program.address })
      trustedForwarder = context.networkFile.data.proxies['PoolTogether3/Forwarder'][0].address
      governor = context.networkFile.data.proxies['PoolTogether3/MockGovernor'][0].address
      rng = context.networkFile.data.proxies['PoolTogether3/RNGServiceMock'][0].address
    }

    await migration.migrate(10, async () => {
      runShell(`oz create CompoundPrizePoolProxyFactory --force ${flags} --init initialize`)
    })

    await migration.migrate(20, async () => {
      runShell(`oz create ControlledTokenProxyFactory --force ${flags} --init initialize`)
    })

    await migration.migrate(25, async () => {
      runShell(`oz create PrizeStrategyProxyFactory --force ${flags} --init initialize`)
    })

    context = await buildContext({ network: program.network, address: program.address })
    const {
      CompoundPrizePoolProxyFactory,
      ControlledTokenProxyFactory,
      PrizeStrategyProxyFactory,
    } = context.contracts

    await migration.migrate(35, async () => {
      runShell(`oz create CompoundPrizePoolBuilder --force ${flags} --init initialize --args ${governor},${PrizeStrategyProxyFactory.address},${trustedForwarder},${CompoundPrizePoolProxyFactory.address},${ControlledTokenProxyFactory.address},${rng}`)
    })

    context = await buildContext({ network: program.network, address: program.address })

    console.log(chalk.green(`Completed deployment.`))
    process.exit(0)
  })

program.parse(process.argv)
