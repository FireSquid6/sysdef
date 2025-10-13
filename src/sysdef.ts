
// used to store and fill in variables
export class VariableStore {
  private map: Map<string, string> = new Map();

  // gets a variable and throws an error if it doesn't exist
  get(k: string): string {
    const v = this.map.get(k);
    if (!v) {
      throw new Error(`Error getting variable: "${k}". It wasn't set anywhere.`);
    }
    return v;
  }
  set(k: string, v: string): void {
    this.map.set(k, v);
  }
  has(k: string): boolean {
    return this.map.has(k);
  }
  getSafe(k: string): string | undefined {
    return this.map.get(k);
  }
  fillIn(s: string) {
    let substr = "";
    let insideBracket = false;
    let newString = "";

    for (let i = 0; i < s.length; i++) {
      if (s[i] === "{") {
        if (insideBracket) {
          newString += "{" + substr;
        }
        substr = "";
        insideBracket = true;
      } else if (s[i] === "}") {
        const v = this.map.get(substr);
        if (insideBracket && v !== undefined) {
          newString += v;
        } else if (insideBracket) {
          newString += "{" + substr + "}";
        } else {
          newString += "}";
        }
        insideBracket = false;
        substr = "";
      } else if (insideBracket) {
        substr += s[i];
      } else {
        newString += s[i];
      }
    }
    
    if (insideBracket) {
      newString += "{" + substr;
    }
    
    return newString;
  }
}

export interface PackageInfo {
  name: string;
  version: string;
  provider: string;
}

export interface ShellResult {
  code: number;
  text: string;
}

export type Shell = (s: string, noThrow?: boolean) => Promise<ShellResult>

export const defaultShell: Shell = async (s, noThrow) => {
  if (noThrow === undefined) {
    noThrow = false;
  }

  const p = Bun.spawn({
    cmd: s.split(" "),
    stdout: "pipe",
    stderr: "inherit",
    stdin: "ignore",
  });
  

  let output = "";
  for await (const chunk of p.stdout) {
    process.stdout.write(chunk);
    output += chunk;
  }

  const code = await p.exited;
  
  if (code !== 0 && !noThrow) {
    throw new Error(`Process called with ${s} returned exit code ${code}`);
  }

  return {
    code,
    text: output,
  }
}

export const dryShell: Shell = async (s) => {
  console.log(`Would run: $ ${s}`);

  return {
    code: 0,
    text: "",
  }
}

export interface Provider {
  readonly name: string;
  // we have to do it with a specific version and name
  install: (packages: PackageInfo[]) => Promise<void>;
  uninstall: (packages: string[]) => Promise<void>;
  getInstalled: () => Promise<PackageInfo[]>;
  update: (packages: string[]) => Promise<void>;
}


export interface Module {
  name: string;
  variables: Record<string, string>;
  packages: Record<string, string[]>;
  onEnable?: (s: Shell) => Promise<void>;
  onDisable?: (s: Shell) => Promise<void>;
  everySync?: (s: Shell) => Promise<void>;
}

export type ProviderGenerator = (s: Shell, v: VariableStore) => Provider;
export type ModuleGenerator = (s: Shell, v: VariableStore) => Module;


