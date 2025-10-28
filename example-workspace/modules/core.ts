import type { ModuleGenerator } from "@src/sysdef";



const m: ModuleGenerator = () => {
  return {
    name: "core",
    variables: {},
    packages: {
      "bun": [
        "marksman",
        "@tailwindcss/cli",
        "typescript",
      ],
    },
    files: {},
    directories: {},
  }
}

export default m;
