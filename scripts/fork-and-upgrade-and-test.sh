trap "exit" INT TERM ERR
trap "kill 0" EXIT

./scripts/fork-and-upgrade.sh &
INFURA_PROVIDER_URL_MAINNET=$LOCALHOST_URL ./upgrade-test/MCDAwarePoolUpgrade.test.js &