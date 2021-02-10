const hardhat = require('hardhat')
const chalk = require("chalk")

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const { ethers, deployments, getNamedAccounts } = hardhat

async function run() {
  const { pool } = await getNamedAccounts()
  const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')
  const poolToken = await ethers.getContractAt('IERC20Upgradeable', pool, gnosisSafe)

  dim(`Disbursing to treasury...`)
  await poolToken.transfer('0xA743f8A9d7c2d7e56e6983d0b60FF19EBc0cE727', ethers.utils.parseEther('6000000'))

  dim(`Disbursing to merkle distributor...`)
  await poolToken.transfer('0x8Bb5Af6F10391CdbFb4C6f141a8B31a55b3411b5', ethers.utils.parseEther('1500000'))

  dim(`Disbursing to employeeA...`)
  await poolToken.transfer('0x21950E281bDE1714ffd1062ed17c56D4D8de2359', ethers.utils.parseEther('10000'))

  dim(`Disbursing to employeeB...`)
  await poolToken.transfer('0xBE1a33519F586A4c8AA37525163Df8d67997016f', ethers.utils.parseEther('400000'))

  dim(`Disbursing to employeeC...`)
  await poolToken.transfer('0xE4E9cDB3E139D7E8a41172C20b6Ed17b6750f117', ethers.utils.parseEther('400000'))

  dim(`Disbursing to employeeD...`)
  await poolToken.transfer('0xE539c8EbE8F6050C7a8733f5C7C449F8D802fBfF', ethers.utils.parseEther('10000'))

  dim(`Disbursing to employeeL...`)
  await poolToken.transfer('0x17CBf69d3dE5c7221AE07CFF6296F661Bb44122b', ethers.utils.parseEther('400000'))

  dim(`Disbursing to employeeLi...`)
  await poolToken.transfer('0x454f5AcbBE96162C0B56c74a37ACf79C65D883AC', ethers.utils.parseEther('10000'))

  dim(`Disbursing to employeeJ...`)
  await poolToken.transfer('0x692F55051Dc060d94227467EE4fbDE72d370728C', ethers.utils.parseEther('4200'))
}

run()


