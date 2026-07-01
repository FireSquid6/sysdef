// Inline Dockerfiles for the e2e environments. Each image bundles `bun` (to run
// sysdef) plus the target package manager. A fake `sudo` that just execs its
// args lets providers' `asRoot`/`sudo ...` paths work while running as root.

import { buildImage } from "./harness";

const FAKE_SUDO = `printf '#!/bin/sh\\nexec "$@"\\n' > /usr/local/bin/sudo && chmod +x /usr/local/bin/sudo`;
const INSTALL_BUN = `curl -fsSL https://bun.com/install | bash && ln -sf /root/.bun/bin/bun /usr/local/bin/bun`;

export const IMAGES = {
  debian: "sysdef-e2e-debian",
  rust: "sysdef-e2e-rust",
  arch: "sysdef-e2e-arch",
} as const;

const built = new Set<string>();

function ensure(tag: string, dockerfile: string): string {
  if (!built.has(tag)) {
    buildImage(tag, dockerfile);
    built.add(tag);
  }
  return tag;
}

/** Debian + apt + bun. Used for the apt and bun providers. */
export function debianImage(): string {
  return ensure(
    IMAGES.debian,
    `FROM debian:stable-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates unzip git xz-utils && rm -rf /var/lib/apt/lists/*
RUN ${FAKE_SUDO}
RUN ${INSTALL_BUN}
`,
  );
}

/** Official rust image (cargo preinstalled) + bun. Used for the cargo provider. */
export function rustImage(): string {
  return ensure(
    IMAGES.rust,
    `FROM rust:slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates unzip git && rm -rf /var/lib/apt/lists/*
RUN ${FAKE_SUDO}
RUN ${INSTALL_BUN}
`,
  );
}

/** Arch Linux + pacman + bun. Used for arch-official (and base for aur/yay). */
export function archImage(): string {
  return ensure(
    IMAGES.arch,
    `FROM archlinux:latest
RUN pacman -Sy --noconfirm --needed archlinux-keyring \
 && pacman -Syu --noconfirm --needed curl unzip git which sudo base-devel
RUN ${INSTALL_BUN}
`,
  );
}
