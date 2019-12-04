const apolloFetch = require('apollo-fetch')

var fetch = apolloFetch.createApolloFetch({ uri: process.env.GRAPHQL_MAINNET_ENDPOINT_URI });

var playersWithBalanceQuery = `
  query allPlayers($first: Int!, $skip: Int!) {
    players (first: $first, skip: $skip, where: { balance_gt: 0 }, orderBy: balance, orderDirection: desc) {
      id
      balance
      sponsorshipBalance
    }
  }
`

async function fetchAllPlayers(query) {
  const pageSize = 1000
  let players = []
  let page = 0
  let hasMore = true
  while (hasMore) {
    page += 1
    const variables = { first: pageSize, skip: pageSize * (page-1) }
    let playersPage = await fetch({
      query,
      variables
    })
    players = players.concat(playersPage.data.players)
    hasMore = playersPage.data.players.length === pageSize
  }
  return players
}

module.exports = async function loadUsers() {
  return await fetchAllPlayers(playersWithBalanceQuery)
}