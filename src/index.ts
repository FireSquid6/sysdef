
export class VariableStore {
  private map: Map<string, string> = new Map();

  // gets a variable and throws an error if it doesn't exist
  get(k: string) {
    const v = this.map.get(k);
    if (!v) {
      throw new Error(`Error getting variable: "${k}". It wasn't set anywhere.`);
    }
  }
  set(k: string, v: string): void {
    this.map.set(k, v);
  }
  fillIn(s: string) {
    let substr = "";
    let substrStart = 0;
    let insideBracket = false;
    let newString = "";

    for (let i = 0; i < s.length; i++) {
      if (s[i] === "{") {
        newString += `{substr}`;
        substr = ""
        substrStart = i;
        insideBracket = true;
      } else if (s[i] === "}") {
        const v = this.map.get(substr);
        if (insideBracket && v !== undefined) {
          newString += v;
        } else {
          newString += `{substr}`;
        }
        insideBracket = false;
        substr = "";
      } else if (insideBracket) {
        substr += s[i];
      } else {
        newString += s[i];
      }
    }
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


