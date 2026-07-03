#1/usr/bin/env bash


cd "$(dirname "$0")" || exit
cd ../package || exit


cp -r "sysdef-src" "$HOME/sysdef"
cp -r "providers" "$HOME/sysdef"
cp -r "test" "$HOME/sysdef"
