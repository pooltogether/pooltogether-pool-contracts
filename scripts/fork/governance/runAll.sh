# in other terminal window
# yarn start-fork


# deploy governance repo with $rm -rf deployments/fork && yarn deploy fork
# deploy merkle-distributor repo with $rm -rf deployments/fork && yarn deploy fork

rm -rf deployments/fork_1



cp -rf deployments/mainnet deployments/localhost
rm deployments/fork_1/CompoundPrizePoolBuilder.json deployments/fork_1/PoolWithMultipleWinnersBuilder.json deployments/fork_1/StakePrizePoolBuilder.json deployments/fork_1/VaultPrizePoolBuilder.json
echo 'deploying v3.2 contracts on fork'
yarn deploy fork


echo 'Taking ether from Binance'
yarn fork-run ./scripts/fork/distributeEtherFromBinance.js

echo 'Distribute tokens to Vesting contracts, treasury and MerkleDistributor'
yarn fork-run ./scripts/fork/governance/disbursePoolTokens.js

echo 'Create token faucets'
yarn fork-run ./scripts/fork/governance/createTokenFaucets.js

echo 'Claim from merkle distributor for whale account'
yarn fork-run ./scripts/fork/governance/claimFromMerkleDistributor.js
echo 'Delegate voting'
yarn fork-run ./scripts/fork/governance/delegate.js


echo 'Create Proposals'
yarn fork-run ./scripts/fork/governance/createProposal.js