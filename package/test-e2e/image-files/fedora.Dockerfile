FROM fedora:latest
# Keep the dnf metadata cache in the image so the first in-container install is
# fast (no cold metadata download at test time).
RUN dnf install -y curl unzip git which && dnf makecache
# Fake sudo (we run as root) so providers' `sudo ...` / asRoot paths work.
RUN printf '#!/bin/sh\nexec "$@"\n' > /usr/local/bin/sudo && chmod +x /usr/local/bin/sudo
# Install bun to run sysdef, symlinked onto PATH.
RUN curl -fsSL https://bun.com/install | bash && ln -sf /root/.bun/bin/bun /usr/local/bin/bun
