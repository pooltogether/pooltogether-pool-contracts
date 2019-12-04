#! /bin/sh
mkdir -p .ganache
ganache-cli \
  -p 8546 \
  -f "$GANACHE_FORK_URL" \
  -u 0x93Be51Af76DC935779f774daD126f99FF9bf1988 \ # sai buddy
  -u 0xbe0eb53f46cd790cd13851d5eff43d12404d33e8 \ # binance
  -u 0x3a9f7c8ca36c42d7035e87c3304ee5cbd353a532 \
  -u 0x0fda4ac09a12c10fae30e429f4d6b47c9a83c87e \
  -u 0x2c6e8512d1cd7fc226ed359269c39a243bd0bb67
