const apolloFetch = require('apollo-fetch')

var fetch = apolloFetch.createApolloFetch({ uri: process.env.GRAPHQL_MAINNET_ENDPOINT_URI });

var playersWithBalanceQuery = `
  query allPlayers($first: Int!, $skip: Int!) {
    players (first: $first, skip: $skip, orderBy: consolidatedBalance, orderDirection: desc) {
      id
      address
      consolidatedBalance
      firstDepositDrawId
      latestBalance
      latestDrawId
    }
  }
`

async function fetchUsers(first = 10, skip = 0) {
  const result = await fetch({
    query: playersWithBalanceQuery,
    variables: {
      first,
      skip
    }
  })

  return result.data.players
}

module.exports = {
  fetchUsers
}