import fs from "fs";
import { v } from "./validation";
import { errorOut } from "./sysdef";


// The trackfile holds per-machine, gitignored state (unlike the lockfile, which
// is committed/shared). It has two sections:
//
//   untracked       - provider -> package/service names the user has explicitly
//                     marked as untracked, suppressed from the "untracked"
//                     warning during sync.
//   enabledServices - serviceProvider -> services sysdef itself enabled. This is
//                     the "managed set" for services: sync only disables services
//                     listed here. It lives here (not the lockfile) because which
//                     services are enabled is per-machine -- two machines sharing
//                     the same committed config may enable different services.
export const trackfileSchema = v.obj({
  untracked: v.record(v.string(), v.array(v.string())),
  enabledServices: v.record(v.string(), v.array(v.string())),
});
export type TrackfileData = v.Infer<typeof trackfileSchema>;

// The pre-services on-disk shape was just the untracked map. Read it so existing
// gitignored trackfiles migrate silently.
const legacyTrackfileSchema = v.record(v.string(), v.array(v.string()));


export class Trackfile {
  private data: TrackfileData = { untracked: {}, enabledServices: {} };

  // --- untracked (packages and services) ---

  // Names explicitly marked as untracked for a provider.
  getUntracked(provider: string): string[] {
    return this.data.untracked[provider] ?? [];
  }

  isUntracked(provider: string, name: string): boolean {
    return this.data.untracked[provider]?.includes(name) ?? false;
  }

  addUntracked(provider: string, name: string) {
    if (!this.data.untracked[provider]) {
      this.data.untracked[provider] = [];
    }
    if (!this.data.untracked[provider].includes(name)) {
      this.data.untracked[provider].push(name);
    }
  }

  removeUntracked(provider: string, name: string) {
    const list = this.data.untracked[provider];
    if (!list) {
      return;
    }
    const next = list.filter(n => n !== name);
    if (next.length === 0) {
      delete this.data.untracked[provider];
    } else {
      this.data.untracked[provider] = next;
    }
  }

  // All providers that have at least one untracked entry.
  getProviders(): string[] {
    return Object.keys(this.data.untracked);
  }

  // --- enabledServices (managed set for services) ---

  // Services sysdef has enabled for a service provider.
  getEnabledServices(provider: string): string[] {
    return this.data.enabledServices[provider] ?? [];
  }

  isServiceEnabled(provider: string, name: string): boolean {
    return this.data.enabledServices[provider]?.includes(name) ?? false;
  }

  // Replace the whole managed set for a service provider. Called after a sync so
  // the managed set is exactly what was requested. An empty list prunes the key.
  setEnabledServices(provider: string, names: string[]) {
    const unique = [...new Set(names)];
    if (unique.length === 0) {
      delete this.data.enabledServices[provider];
    } else {
      this.data.enabledServices[provider] = unique;
    }
  }

  // All service providers that have at least one managed service.
  getServiceProviders(): string[] {
    return Object.keys(this.data.enabledServices);
  }

  serializeToFile(filepath: string) {
    const json = JSON.stringify(this.data);
    fs.writeFileSync(filepath, json);
  }

  readFromFile(filepath: string) {
    if (!fs.existsSync(filepath)) {
      // if the filepath doesn't exist, we can't read from it. Therefore,
      // the trackfile is empty
      return;
    }

    const contents = fs.readFileSync(filepath).toString();
    const json = JSON.parse(contents);

    const data = v.parseSafe(json, trackfileSchema);
    if (data) {
      this.data = data;
      return;
    }

    // Fall back to the legacy (pre-services) flat shape and migrate it.
    const legacy = v.parseSafe(json, legacyTrackfileSchema);
    if (legacy) {
      this.data = { untracked: legacy, enabledServices: {} };
      return;
    }

    errorOut(`Failed to read trackfile from ${filepath}`);
  }
}
