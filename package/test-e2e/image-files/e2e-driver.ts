// Runs inside the e2e container. Loads a real provider with the real
// defaultShell and performs one action, so tests exercise the actual provider
// code against the actual package manager.
//
// The install is laid down at /sysdef, so this file runs from
// /sysdef/test-e2e/image-files/e2e-driver.ts -- hence the ../../ imports resolve
// to /sysdef/sysdef-src and /sysdef/providers, matching their in-repo layout.
//
// Invoked as: bun run test-e2e/image-files/e2e-driver.ts <provider> <action> [args...]
//   action = install | uninstall | update | installed

import { defaultShell, ANY_VERSION_STRING, type PackageInfo } from "../../sysdef-src/sysdef";

const providerName = process.argv[2]!;
const action = process.argv[3]!;
const rest = process.argv.slice(4);

const gen = (await import(`../../providers/${providerName}.ts`)).default;
const provider = gen(defaultShell);

function toPackageInfo(spec: string): PackageInfo {
  const i = spec.indexOf(":");
  if (i < 0) return { name: spec, version: ANY_VERSION_STRING, provider: providerName };
  return { name: spec.slice(0, i), version: spec.slice(i + 1), provider: providerName };
}

if (action === "install") {
  await provider.install(rest.map(toPackageInfo));
} else if (action === "uninstall") {
  await provider.uninstall(rest);
} else if (action === "update") {
  await provider.update(rest);
} else if (action === "installed") {
  const list = await provider.getInstalled();
  console.log("JSON:" + JSON.stringify(list));
} else {
  throw new Error("unknown action: " + action);
}
