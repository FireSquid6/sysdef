#!/usr/bin/env bash

cd "$(dirname "$0")/.." || exit

mkdir -p ./example-workspace/sysdef-src
cp -r ./package/src/* ./example-workspace/sysdef-src
