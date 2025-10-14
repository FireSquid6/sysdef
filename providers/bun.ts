import type { ProviderGenerator, Shell } from "../src/sysdef";

// bun povider - installs packages globally


const mod: ProviderGenerator = (run: Shell) => {
  return {
    name: "bun",
    async install(packages) {
      await Promise.all(packages.map(p => run(`bun install -g ${p.name}@${p.version}`)));
    },

    async uninstall() {

    },

    async getInstalled() {
      return [];
    },
    async update(packages) {
        
    },
    async initialize() {
        
    },
  }
}

export default mod;
