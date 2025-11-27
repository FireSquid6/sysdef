#!/usr/bin/env bash


cd "$(dirname "$0")" || exit
cd ..

SYSDEF_DIRECTORY="$1"

if [ -z "$SYSDEF_DIRECTORY" ]; then
  SYSDEF_DIRECTORY="$HOME/sysdef"
fi

if [ -e "$SYSDEF_DIRECTORY" ]; then
  echo "Install directory $SYSDEF_DIRECTORY contains something. Remove it and run again."
  exit 1
fi


mkdir -p "$SYSDEF_DIRECTORY"
mkdir -p "$SYSDEF_DIRECTORY/modules"
mkdir -p "$SYSDEF_DIRECTORY/bin"
cp -r ./package/sysdef-src "$SYSDEF_DIRECTORY"
cp -r ./package/providers "$SYSDEF_DIRECTORY"
cp -r ./package/test "$SYSDEF_DIRECTORY"
cp -r ./package/bin "$SYSDEF_DIRECTORY"
cp ./package/package.json "$SYSDEF_DIRECTORY"
cp ./package/tsconfig.json "$SYSDEF_DIRECTORY"
cp ./package/bun.lock "$SYSDEF_DIRECTORY"
cp ./package/.gitignore "$SYSDEF_DIRECTORY"
cp ./starter/config.yaml "$SYSDEF_DIRECTORY"
cp ./starter/example-module.ts "$SYSDEF_DIRECTORY/modules/example.ts"

cp ./starter/sysdef "$SYSDEF_DIRECTORY/bin"
chmod +x "$SYSDEF_DIRECTORY/bin/sysdef"

cd "$SYSDEF_DIRECTORY" || exit

echo "  - HOMEDIR: $HOME" >> config.yaml

mkdir dotfiles
echo "Content in the dotfile" > dotfiles/sysdef-example-dotfile.txt

echo "Installing bun..."
curl -fsSL https://bun.com/install | bash
cp "$HOME/.bun/bin/bun" "./bin/bun"

bun install

echo ""
echo "Done! Your fresh sysdef has been created in $SYSDEF_DIRECTORY"
echo "Make sure to add $SYSDEF_DIRECTORY/bin to your path to get access to the sysdef command"
