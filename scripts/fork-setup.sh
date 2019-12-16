#!/bin/sh
rm -rf build
oz compile
yarn fork pay
yarn fork push
yarn fork upgrade-v2x
# for some reason deploy dai breaks the sai contract
yarn fork deploy-dai
# yarn fork reward-open dai 3
# yarn fork reward-open sai 2