# Mainnet Forking Guide

Start fork - this will run the deploy script.

```sh
$ yarn deploy fork 
```

Open new terminal window. Set path to governance repo with:
```sh
 export PathToGovernanceRepoFund=<insert path>
```


Fund and impersonate accounts:

```sh
$ ./scripts/fork/governance/runAll
```

Deploy Governance Contracts
```sh
$cd governance; yarn clean && yarn rm -rf deployments/fork && yarn deploy fork;

```
Copy Pool address into merkle-dsitrbutor namedAccount in hardhat.config.js:
```sh
cd merkle-distributor && rm -rf deployments/fork && yarn deploy fork
```

Change to governance repo and: 

Distribute Pool tokens, Delegate Voting of Pool and Run thru the proposal process with:
```sh
$ yarn test
```

Change back to merkle-distributor repo and Claim from merkle distributor for whale account:
```sh
$ yarn run-fork ./test/claimFromMerkleDistributor.js
```




