#!/usr/bin/env bash

cd "$(dirname "$0")/.." || exit

cd ./example-workspace || exit

ln -s ../package/src ./sysdef-src

rm -rf ./example-workspace/sysdef-src
rm -rf ./example-workspace/providers

mkdir -p ./example-workspace/sysdef-src
cp -r ./package/src/* ./example-workspace/sysdef-src

mkdir -p ./example-workspace/providers
cp ./providers/bun.ts ./example-workspace/providers/
