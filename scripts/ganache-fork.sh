#! /bin/sh
ganache-cli \
  --fork $GANACHE_FORK_URL \
  -b 0 \
  -l 10000000 $GANACHE_FORK_EXTRA_OPTIONS
