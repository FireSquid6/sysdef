
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

  insertAll(r: Record<string, string>) {
    for (const [k, v] of Object.entries(r)) {
      this.map.set(k, v);
    }
  }

  // creates a new variable store including all of the ones already present
  // plus some ones from a new record
  branchOff(r: Record<string, string>): VariableStore {
    const store = new VariableStore();
    for (const k of this.map.keys()) {
      store.set(k, this.map.get(k)!);
    }

    store.insertAll(r);
    return store;
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
  initialize: () => Promise<void>;
}


// when just a string, the file treats it as a filepath in the `dotfiles` directory. Otherwise,
// the function that generates a string is treated as something that will return what should be 
// the contents of the file. You can use the variable store in this case. 
//
// It's a difference between a symlink and a generated file.
export type File = string | (() => string);


export interface Module {
  readonly name: string;
  readonly variables: Record<string, string>;

  readonly packages: Record<string, string[]>;
  readonly directories: Record<string, string>;  
  readonly files: Record<string, File>;
  
  // factory files are made and include all of the variables
  readonly factoryFiles: Record<string, string>;

  readonly onEnable?: (s: Shell) => Promise<void>;
  readonly onDisable?: (s: Shell) => Promise<void>;
  readonly onEverySync?: (s: Shell) => Promise<void>;
}

export type ProviderGenerator = (s: Shell, v: VariableStore) => Provider;
export type ModuleGenerator = (s: Shell, v: VariableStore) => Module;



export async function syncPackages(modules: Module[], providers: Provider[]) {
  // sync all dotfiles

}

export async function syncFiles(modules: Module[]) {

}

export async function runEvents(modules: Module[]) {

}


