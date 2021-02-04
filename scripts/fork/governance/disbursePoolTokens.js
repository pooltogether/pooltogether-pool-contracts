const buidler = require('@nomiclabs/buidler')
const chalk = require("chalk")

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const { ethers, deployments, getNamedAccounts } = buidler

async function run() {
  const { pool , merkleDistributor, treasuryVesting} = await getNamedAccounts()
  const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')
  const poolToken = await ethers.getContractAt('IERC20Upgradeable', pool, gnosisSafe)

  dim(`Disbursing to treasury...`)
  await poolToken.transfer(treasuryVesting, ethers.utils.parseEther('6000000'))

  dim(`Disbursing to merkle distributor...`)
  await poolToken.transfer(merkleDistributor, ethers.utils.parseEther('1500000'))

  dim(`Disbursing to employeeA...`)
  await poolToken.transfer('0xCcDD14e54F5ff6769235F4d09D07E61F01368246', ethers.utils.parseEther('10000'))

  dim(`Disbursing to employeeB...`)
  await poolToken.transfer('0xE59d48B89555aD130b48500bf599c1EF397974e8', ethers.utils.parseEther('400000'))

  dim(`Disbursing to employeeC...`)
  await poolToken.transfer('0x7A426B6FB3C9cA943465317AFE58653Fc42B3EEE', ethers.utils.parseEther('400000'))

  dim(`Disbursing to employeeD...`)
  await poolToken.transfer('0x13465E8744a4e0e21A383b3600918038C75A3EE4', ethers.utils.parseEther('10000'))

  dim(`Disbursing to employeeL...`)
  await poolToken.transfer('0x2f8108Bd0a8390CA993E3bDd887f5C50c880cB6a', ethers.utils.parseEther('400000'))

  dim(`Disbursing to employeeLi...`)
  await poolToken.transfer('0xB6A4D57e0792e60E5F1d6f2E3F62eb3be412BEDE', ethers.utils.parseEther('10000'))

  dim(`Disbursing to employeeJ...`)
  await poolToken.transfer('0x880617adfDDd57FED6b635a951aa1835e52BbA97', ethers.utils.parseEther('4200'))
}

run()


