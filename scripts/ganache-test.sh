trap "exit" INT TERM ERR
trap "kill 0" EXIT

#! /bin/sh
ganache-cli \
  -l 12000038 \
  -i 5777 \
  -e 100000 \
  -a 10 \
  -p 7545 \
  -u 0 \
  --allowUnlimitedContractSize \
  -g 1000000000 > /dev/null &

sleep 3
