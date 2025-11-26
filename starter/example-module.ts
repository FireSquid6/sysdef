import type { ModuleGenerator } from "../package/sysdef-src/sysdef";


const m: ModuleGenerator = () => {
  return {
    name: "core",
    // variables can be redeclared
    variables: {},
    files: {
      // you can defined files that link to something locally:
      "{HOMEDIR}/example-config-file.txt": "./dotfiles/sysdef-example-dotfile.txt",
      
      // alternatively, a string returning function can be used to generate the
      // contents of the file
      //
      // this can use variables as well--useful for per machine differences
      "{HOMEDIR}/": (variables) => {
        return `The home directory is: ${variables.get("HOMEDIR")}`
      },
    },
    // if you'd like to link an entire directory, do so below
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
