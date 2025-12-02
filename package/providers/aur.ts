import { defaultShell, type PackageInfo, type ProviderGenerator, type Shell } from "../sysdef-src/sysdef";
import { partitionArray, stringifyPackageParition } from "../sysdef-src/prompt";

// AUR provider - installs packages from the Arch User Repository
const MAX_AT_ONCE = 5;

// we use the default shell when getting the list of all installed packages since
// we want that to happen even in a dry run
const realShell = defaultShell

// Fetch, build, and install a package from the AUR
async function buildAndInstallFromAUR(run: Shell, packageName: string): Promise<void> {
  const buildDir = `/tmp/aur-builds/${packageName}`;
  const aurUrl = `https://aur.archlinux.org/${packageName}.git`;

  // Remove existing build directory if it exists
  await realShell(`rm -rf ${buildDir}`, {});

  // Clone the AUR repository
  console.log(`Cloning ${packageName} from AUR...`);
  const cloneResult = await realShell(`git clone ${aurUrl} ${buildDir}`, {
    displayOutput: true,
  });

  if (cloneResult.code !== 0) {
    throw new Error(`Failed to clone ${packageName} from AUR`);
  }

  // Build the package with makepkg -s (installs build dependencies)
  console.log(`Building ${packageName}...`);
  const buildResult = await realShell(`cd ${buildDir} && makepkg -s --noconfirm`, {
    displayOutput: true,
  });

  if (buildResult.code !== 0) {
    throw new Error(`Failed to build ${packageName}`);
  }

  // Find the built package file
  const findPkgResult = await realShell(`find ${buildDir} -maxdepth 1 -name '*.pkg.tar.zst' -o -name '*.pkg.tar.xz'`, {});
  const pkgFile = findPkgResult.stdout.trim().split('\n')[0];

  if (!pkgFile) {
    throw new Error(`Could not find built package for ${packageName}`);
  }

  // Install the package
  console.log(`Installing ${packageName}...`);
  const installResult = await run(`pacman -U --noconfirm ${pkgFile}`, {
    displayOutput: true,
    asRoot: true,
  });

  if (installResult.code !== 0) {
    throw new Error(`Failed to install ${packageName}`);
  }

  // Clean up build directory
  await realShell(`rm -rf ${buildDir}`, {});
  console.log(`Successfully installed ${packageName} from AUR`);
}

const provider: ProviderGenerator = (run: Shell) => {
  return {
    name: "aur",
    async checkInstallation() {
      const result = await run(`which pacman`, {
        throwOnError: true
      });
      if (result.code !== 0) {
        throw new Error("pacman is not installed or not in PATH");
      }
    },
    async install(packages: PackageInfo[]) {
      // TODO: Implement AUR package installation
      const partitions = partitionArray(packages, MAX_AT_ONCE);

      for (const part of partitions) {
        const string = stringifyPackageParition(part);
        console.log(`Installing ${string}`);
        const result = await run(`pacman -S --noconfirm ${string}`, {
          displayOutput: true,
          asRoot: true,
        });
        if (result.code !== 0) {
          console.log(`Error installing packages: ${part}. See the logs above`);
        }
      }
    },

    async uninstall(packages: string[]) {
      const partitions = partitionArray(packages, MAX_AT_ONCE);

      for (const part of partitions) {
        const string = part.join(" ");
        console.log(`Uninstalling ${string}`);
        const result = await run(`pacman -Rs --noconfirm ${string}`, {
          displayOutput: true,
          asRoot: true,
        });

        if (result.code !== 0) {
          console.log(`Error uninstalling packages: ${part}. See the logs above`);
        }
      }
    },

    async getInstalled() {
      // Get foreign/AUR packages
      const result = await realShell(`pacman -Qm`, {});
      const lines = result.stdout.trim().split('\n').filter(line => line.trim());

      return lines.map(line => {
        const match = line.match(/^(\S+)\s+(.+)$/);
        if (!match || !match[1] || !match[2]) {
          throw new Error(`Failed to parse pacman package line: ${line}`);
        }

        return {
          name: match[1],
          provider: "aur",
          version: match[2],
        };
      });
    },

    async update(packages: string[]) {
      // TODO: Implement AUR package update
      const partitions = partitionArray(packages, MAX_AT_ONCE);

      for (const part of partitions) {
        const string = part.join(" ");
        console.log(`Updating ${string}`);
        const result = await run(`pacman -Syu --noconfirm ${string}`, {
          displayOutput: true,
          asRoot: true,
        });

        if (result.code !== 0) {
          console.log(`Error updating packages: ${part}. See the logs above`);
        }
      }
    },
  };
};

export default provider;
