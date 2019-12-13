#!/bin/sh
rm -rf build
oz compile
yarn fork pay
yarn fork push
yarn fork upgrade-v2x
yarn fork deploy-dai
# yarn fork reward dai 2
# yarn fork migrate-sai