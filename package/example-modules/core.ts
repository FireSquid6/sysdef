import type { ModuleGenerator } from "../sysdef-src/sysdef";



const m: ModuleGenerator = () => {
  return {
    name: "core",
    variables: {
      "HOME": "/home/me/"
    },
    files: {
      // you can defined files that link to something locally:
      "{HOME}/.config/example-config-file.txt": "./configfile.txt"
    },
    directories: {},
    packages: {
      // we can define the packages per provider in this
      "bun": [
        "@tailwindcss/cli",
        // the colon indicates a specific version. This will
        // force typescript version 5.9.3
        "typescript:5.9.3",
      ],
    }
  }

}


export default m;
