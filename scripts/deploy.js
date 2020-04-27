const buidler = require('@nomiclabs/buidler')
const chalk = require('chalk')

const PrizePoolFactory = require('../build/PrizePoolFactory.json')
const InterestPoolFactory = require('../build/InterestPoolFactory.json')
const TicketPoolFactory = require('../build/TicketPoolFactory.json')
const TicketFactory = require('../build/TicketFactory.json')
const ControlledTokenFactory = require('../build/ControlledTokenFactory.json')
const PrizeStrategyFactory = require('../build/PrizeStrategyFactory.json')

const ethers = buidler.ethers
const provider = ethers.provider

async function deploy(artifact, signer, constructorParams = []) {
  console.log(chalk.dim(`Deploying ${artifact.contractName}...`))
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer)
  const contract = await factory.deploy(...constructorParams)
  await contract.deployed()
  console.log(chalk.green(`Deployed ${artifact.contractName} to ${contract.address}`))
  return contract
}

async function main() {
  console.log(chalk.dim(`Starting deployment to ${buidler.network.name}...`))

  const signers = await ethers.getSigners()
  const signer = signers[0]

  let interestPoolFactory,
      ticketPoolFactory,
      ticketFactory

  interestPoolFactory = await deploy(InterestPoolFactory, signer)
  ticketPoolFactory = await deploy(TicketPoolFactory, signer)
  ticketFactory = await deploy(TicketFactory, signer)
  controlledTokenFactory = await deploy(ControlledTokenFactory, signer)
  prizeStrategyFactory = await deploy(PrizeStrategyFactory, signer)
  prizePoolFactory = await deploy(PrizePoolFactory, signer, [
    interestPoolFactory.address,
    ticketPoolFactory.address,
    ticketFactory.address,
    controlledTokenFactory.address,
    prizeStrategyFactory.address
  ])

  console.log(chalk.green(`Deploy Successful`))
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });