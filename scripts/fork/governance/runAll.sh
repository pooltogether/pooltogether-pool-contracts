# in other terminal window
# yarn start-fork


# deploy governance repo with $rm -rf deployments/fork && yarn deploy fork
# deploy merkle-distributor repo with $rm -rf deployments/fork && yarn deploy fork

# rm -rf deployments/fork_1



# cp -rf deployments/mainnet deployments/localhost
# rm deployments/fork_1/CompoundPrizePoolBuilder.json deployments/fork_1/PoolWithMultipleWinnersBuilder.json deployments/fork_1/StakePrizePoolBuilder.json deployments/fork_1/VaultPrizePoolBuilder.json
# echo 'deploying v3.2 contracts on fork'
# yarn deploy fork

yarn impersonate-accounts

echo 'Taking ether from Binance'
yarn fork-run ./scripts/fork/distributeEtherFromBinance.js

echo 'Create token faucets'
yarn fork-run ./scripts/fork/governance/createTokenFaucets.js

# echo 'Stopping gnosis safe impersonation'
# yarn stop-impersonate