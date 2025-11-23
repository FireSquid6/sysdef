#!/usr/bin/env bash


echo "Cloning the git repository..."
git clone https://github.com/firesquid6/sysdef sysdef-codebase
./sysdef-codebase/scripts/initialize-workspace.sh
rm -rf sysdef-codebase
