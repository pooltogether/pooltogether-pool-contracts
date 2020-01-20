#!/bin/sh
rm -rf build
oz compile
yarn fork pay
yarn fork push