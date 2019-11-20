trap "exit" INT TERM ERR
trap "kill 0" EXIT

# If an old backup was left over, copy it back
if [ -a .openzeppelin/mainnet_backup.json ]
then
  cp .openzeppelin/mainnet_backup.json .openzeppelin/mainnet.json
fi
cp .openzeppelin/mainnet.json .openzeppelin/mainnet_backup.json

# Run Ganache CLI in background
./scripts/ganache-fork.sh &

# Wait for ganache
sleep 4

echo "Starting tests..."

# Ensure that we override the mainnet URL
INFURA_PROVIDER_URL_MAINNET=$LOCALHOST_URL oz-console -n $LOCALHOST_URL -c .openzeppelin/mainnet.json -e ./upgrade-test/MCDAwarePoolUpgrade.test.js

cp .openzeppelin/mainnet.json .openzeppelin/mainnet_fork.json
mv .openzeppelin/mainnet_backup.json .openzeppelin/mainnet.json