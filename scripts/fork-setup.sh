#!/bin/sh
rm -rf build
oz compile
yarn fork start
yarn fork impersonate
yarn fork pay
yarn fork push
yarn fork upgrade-auto
yarn fork set-reward-fees