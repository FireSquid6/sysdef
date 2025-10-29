import type { ModuleGenerator } from "../sysdef-src/sysdef";



const m: ModuleGenerator = () => {
  return {
    name: "core",
    packages: {
      // we can define the packages per provider in this
      "bun": [
        "@tailwindcss/cli",
        ""
      ],
    }
  }

}


export default m;
