
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


export interface Provider {
  getName: () => string;
  install: (packages: string[]) => Promise<void>;
  uninstall: (packages: string[]) => Promise<void>;
  getInstalled: () => Promise<PackageInfo[]>;
  update: (packages: string[]) => Promise<void>;
}

export type ProviderModule = (v: VariableStore) => Provider


