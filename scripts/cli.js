#!/usr/bin/env node
const commander = require('commander');
const chalk = require('chalk')
const { Project } = require('@pooltogether/oz-migrate')
const { runShell } = require('./runShell')

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

    let trustedForwarder, governor
    if (program.network == 'kovan') {
      trustedForwarder = '0x6453D37248Ab2C16eBd1A8f782a2CBC65860E60B'
      governor = '0x2f935900D89b0815256a3f2c4c69e1a0230b5860'
    } else {
      context = await buildContext({ network: program.network, address: program.address })
      trustedForwarder = context.networkFile.data.proxies['PoolTogether3/Forwarder'][0].address
      governor = context.networkFile.data.proxies['PoolTogether3/MockGovernor'][0].address
    }

    await migration.migrate(10, async () => {
      runShell(`oz create OwnableModuleManagerFactory --force ${flags} --init initialize`)
    })

    await migration.migrate(15, async () => {
      runShell(`oz create CompoundYieldServiceFactory --force ${flags} --init initialize`)
    })

    await migration.migrate(20, async () => {
      runShell(`oz create PeriodicPrizePoolFactory --force ${flags} --init initialize`)
    })

    await migration.migrate(30, async () => {
      runShell(`oz create TicketFactory --force ${flags} --init initialize`)
    })

    await migration.migrate(40, async () => {
      runShell(`oz create LoyaltyFactory --force ${flags} --init initialize`)
    })

    await migration.migrate(50, async () => {
      runShell(`oz create SingleRandomWinnerPrizeStrategyFactory --force ${flags} --init initialize`)
    })

    await migration.migrate(55, async () => {
      runShell(`oz create RNGBlockhash --force ${flags}`)
    })

    await migration.migrate(57, async () => {
      runShell(`oz create OwnableModuleManagerFactory --force ${flags} --init initialize`)
    })

    await migration.migrate(58, async () => {
      runShell(`oz create TimelockFactory --force ${flags} --init initialize`)
    })

    await migration.migrate(59, async () => {
      runShell(`oz create SponsorshipFactory --force ${flags} --init initialize`)
    })

    context = await buildContext({ network: program.network, address: program.address })
    const { 
      OwnableModuleManagerFactory,
      CompoundYieldServiceFactory,
      PeriodicPrizePoolFactory,
      TicketFactory,
      TimelockFactory,
      SponsorshipFactory,
      LoyaltyFactory,
      SingleRandomWinnerPrizeStrategyFactory,
      RNGBlockhash
    } = context.contracts

    /*
    console.log({
      OwnableModuleManagerFactory: OwnableModuleManagerFactory.address,
      CompoundYieldServiceFactory: CompoundYieldServiceFactory.address,
      PeriodicPrizePoolFactory: PeriodicPrizePoolFactory.address,
      TicketFactory: TicketFactory.address,
      LoyaltyFactory: LoyaltyFactory.address,
      SingleRandomWinnerPrizeStrategyFactory: SingleRandomWinnerPrizeStrategyFactory.address,
      governor
    })

    throw new Error('wtf mate')
    */

    await migration.migrate(60, async () => {
      runShell(`oz create PrizePoolBuilder --force ${flags} --init initialize --args ${OwnableModuleManagerFactory.address},${governor},${CompoundYieldServiceFactory.address},${PeriodicPrizePoolFactory.address},${TicketFactory.address},${TimelockFactory.address},${SponsorshipFactory.address},${LoyaltyFactory.address},${RNGBlockhash.address},${trustedForwarder}`)
    })

    context = await buildContext({ network: program.network, address: program.address })
    const {
      PrizePoolBuilder,
    } = context.contracts

    await migration.migrate(80, async () => {
      runShell(`oz create SingleRandomWinnerPrizePoolBuilder --force ${flags} --init initialize --args ${PrizePoolBuilder.address},${SingleRandomWinnerPrizeStrategyFactory.address}`)
    })

    console.log(chalk.green(`Completed deployment.`))
    process.exit(0)
  })

program.parse(process.argv)