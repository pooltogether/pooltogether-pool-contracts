const { fetchUsers } = require('./fetchUsers')
const {
  POOL_ADMIN,
  BINANCE_ADDRESS,
  SAI_BUDDY,
  HD_FIRST_ADDRESS,
  LITTLE_SAI_GUY,
  MULTISIG_ADMIN1,
  MULTISIG_ADMIN2,
  DAI_BUDDY
} = require('./helpers/constants')

function fetchAdmins() {
  return [
    POOL_ADMIN,
    BINANCE_ADDRESS,
    HD_FIRST_ADDRESS,
    process.env.ADMIN_ADDRESS,
    SAI_BUDDY,
    LITTLE_SAI_GUY,
    MULTISIG_ADMIN1,
    MULTISIG_ADMIN2,
    DAI_BUDDY
  ]
}

function fetchAllUsers() {

  const daiUsers = fetchUsers('dai')
  const saiUsers = fetchUsers('sai')
  const usdcUsers = fetchUsers('usdc')
  const admins = fetchAdmins()

  return daiUsers.concat(saiUsers).concat(usdcUsers).concat(admins)
}

module.exports = {
  fetchAllUsers
}