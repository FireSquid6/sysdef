// e2e environment images. Each bundles `bun` (to run sysdef) plus the target
// package manager. The Dockerfiles live as real files in ./image-files and are
// read from disk here. A fake `sudo` that just execs its args lets providers'
// `asRoot`/`sudo ...` paths work while running as root.

import fs from "fs";
import path from "path";
import { buildImage } from "./harness";

const IMAGE_FILES = path.join(import.meta.dir, "image-files");

export const IMAGES = {
  debian: "sysdef-e2e-debian",
  rust: "sysdef-e2e-rust",
  arch: "sysdef-e2e-arch",
} as const;

const built = new Set<string>();

function ensure(tag: string, dockerfileName: string): string {
  if (!built.has(tag)) {
    const dockerfile = fs.readFileSync(path.join(IMAGE_FILES, dockerfileName), "utf8");
    buildImage(tag, dockerfile);
    built.add(tag);
  }
  return tag;
}

/** Debian + apt + bun. Used for the apt and bun providers. */
export function debianImage(): string {
  return ensure(IMAGES.debian, "debian.Dockerfile");
}

/** Official rust image (cargo preinstalled) + bun. Used for the cargo provider. */
export function rustImage(): string {
  return ensure(IMAGES.rust, "rust.Dockerfile");
}

/** Arch Linux + pacman + bun. Used for arch-official (and base for aur/yay). */
export function archImage(): string {
  return ensure(IMAGES.arch, "arch.Dockerfile");
}
