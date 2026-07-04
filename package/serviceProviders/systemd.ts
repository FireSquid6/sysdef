// service provider for systemd units
import { defaultShell, errorOut, type ServiceProviderGenerator, type Shell } from "../sysdef-src/sysdef";

// getEnabled must run even under --dry-run so the diff is accurate, so it uses
// the real shell rather than the (possibly dry) injected one -- same trick the
// package providers use for getInstalled().
const realShell = defaultShell;

// Parse the output of
//   systemctl list-unit-files --type=service --state=enabled --no-legend --no-pager
// whose lines look like "foo.service enabled enabled". Returns the bare unit
// names (with the .service suffix stripped) so they match how modules declare
// services. Exported so the parsing can be unit-tested without a shell.
export function parseEnabledServices(stdout: string): string[] {
  return stdout
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.split(/\s+/)[0]!)
    .map(name => name.replace(/\.service$/, ""));
}

const provider: ServiceProviderGenerator = (run: Shell) => {
  return {
    name: "systemd",
    async checkInstallation() {
      const result = await run(`which systemctl`, {
        throwOnError: true,
      });
      if (result.code !== 0) {
        throw new Error("systemctl is not installed or not in PATH");
      }
    },

    async enable(services: string[]) {
      if (services.length === 0) {
        return;
      }
      console.log(`Enabling ${services.join(" ")}`);
      // --now also starts the service immediately, not just on next boot.
      const result = await run(["systemctl", "enable", "--now", ...services], {
        displayOutput: true,
        asRoot: true,
        throwOnError: true,
      });
      if (result.code !== 0) {
        errorOut(`Failed to enable services: ${services.join(" ")} (exit code ${result.code})`);
      }
    },

    async disable(services: string[]) {
      if (services.length === 0) {
        return;
      }
      console.log(`Disabling ${services.join(" ")}`);
      const result = await run(["systemctl", "disable", "--now", ...services], {
        displayOutput: true,
        asRoot: true,
        throwOnError: true,
      });
      if (result.code !== 0) {
        errorOut(`Failed to disable services: ${services.join(" ")} (exit code ${result.code})`);
      }
    },

    async getEnabled() {
      const result = await realShell(
        `systemctl list-unit-files --type=service --state=enabled --no-legend --no-pager`,
        { throwOnError: true },
      );
      return parseEnabledServices(result.stdout);
    },
  };
};

export default provider;
