#!/usr/bin/env bash


cd "$(dirname "$0")" || exit
cd ..

SYSDEF_DIRECTORY="$HOME/sysdef"


mkdir -p "$SYSDEF_DIRECTORY"
mkdir -p "$SYSDEF_DIRECTORY/modules"
cp -r ./package/sysdef-src "$SYSDEF_DIRECTORY"
cp -r ./package/providers "$SYSDEF_DIRECTORY"
cp -r ./package/test "$SYSDEF_DIRECTORY"
cp -r ./package/bin "$SYSDEF_DIRECTORY"
cp ./package/package.json "$SYSDEF_DIRECTORY"
cp ./package/tsconfig.json "$SYSDEF_DIRECTORY"
cp ./package/bun.lock "$SYSDEF_DIRECTORY"
cp ./package/.gitignore "$SYSDEF_DIRECTORY"

cd "$SYSDEF_DIRECTORY" || exit

bun install

echo ""
echo "Done! Your fresh sysdef has been created in $SYSDEF_DIRECTORY"
echo "Make sure to add $SYSDEF_DIRECTORY/bin to your path to get access to the sysdef command"

