#!/bin/sh
rm -rf build
oz compile
yarn fork pay
yarn fork push
yarn fork upgrade-pool
yarn fork migrate