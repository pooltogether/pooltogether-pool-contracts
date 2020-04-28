#!/usr/bin/env node
const commander = require('commander');
const chalk = require('chalk')
const { Project } = require('@pooltogether/oz-migrate')
const { runShell } = require('./runShell')

const ProjectFile = require('@openzeppelin/cli/lib/models/files/ProjectFile').default
const NetworkFile = require('@openzeppelin/cli/lib/models/files/NetworkFile').default
const ConfigManager = require("@openzeppelin/cli/lib/models/config/ConfigManager").default

const program = new commander.Command()
program.description('Deploys the PoolTogether smart contracts')
program.option('-n --network [network]', 'configure OpenZeppelin network', 'kovan')
program.option('-a --address [address]', 'configures the address to deploy from', process.env.ADMIN_ADDRESS)

program
  .command('start')
  .action(async () => {
    console.log(chalk.dim(`Starting deployment to ${program.network}....`))

    const projectFile = new ProjectFile()
    const networkConfig = await ConfigManager.initNetworkConfiguration({
      network: program.network
    });

    const project = new Project('.oz-migrate')
    const migration = await project.migrationForNetwork(networkConfig.network)

    runShell(`oz session --network ${program.network} --from ${program.address} --expires 3600 --timeout 600 --blockTimeout 50`)

    await migration.migrate(10, async () => {
      runShell(`oz create InterestPoolFactory --force --init initialize`)
    })

    await migration.migrate(20, async () => {
      runShell(`oz create PrizePoolFactory --force --init initialize`)
    })

    await migration.migrate(30, async () => {
      runShell(`oz create TicketFactory --force --init initialize`)
    })

    await migration.migrate(40, async () => {
      runShell(`oz create ControlledTokenFactory --force --init initialize`)
    })

    await migration.migrate(50, async () => {
      runShell(`oz create SingleRandomWinnerPrizeStrategyFactory --force --init initialize`)
    })

    let networkFile = new NetworkFile(projectFile, networkConfig.network)
    const {
      InterestPoolFactory,
      PrizePoolFactory,
      TicketFactory,
      ControlledTokenFactory,
      SingleRandomWinnerPrizeStrategyFactory
    } = networkFile.contracts

    await migration.migrate(60, async () => {
      runShell(`oz create PrizePoolBuilder --force --init initialize --args ${InterestPoolFactory.address},${PrizePoolFactory.address},${TicketFactory.address},${ControlledTokenFactory.address}`)
    })

    networkFile = new NetworkFile(projectFile, networkConfig.network)
    const {
      PrizePoolBuilder
    } = networkFile.contracts

    await migration.migrate(70, async () => {
      runShell(`oz create SingleRandomWinnerPrizePoolBuilder --force --init initialize --args ${PrizePoolBuilder.address},${SingleRandomWinnerPrizeStrategyFactory.address}`)
    })

    console.log(chalk.green(`Completed deployment.`))
  })

program.parse(process.argv)