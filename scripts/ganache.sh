#! /bin/sh
# mkdir -p .ganache
#   --db .ganache \
ganache-cli \
  -l 10000038 \
  -i 1234 \
  -e 100000 \
  -a 10 \
  -u 0 \
  -g 1000000000 \
  --allowUnlimitedContractSize \
  -m "$HDWALLET_MNEMONIC"
