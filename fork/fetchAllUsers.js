const { fetchUsers } = require('./fetchUsers')

async function fetchAllUsers() {
  const pageSize = 1000
  let players = []
  let page = 0
  let hasMore = true
  while (hasMore) {
    page += 1
    let playersPage = await fetchUsers(
      pageSize,
      pageSize * (page-1)
    )
    players = players.concat(playersPage)
    hasMore = playersPage.length === pageSize
  }
  return players
}

module.exports = {
  fetchAllUsers
}