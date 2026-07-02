FROM debian:stable-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates unzip git python3 python3-pip pipx && rm -rf /var/lib/apt/lists/*
# pipx puts app shims here; make sure they (and pipx itself) are on PATH.
ENV PATH="/root/.local/bin:${PATH}"
RUN pipx ensurepath || true
# Fake sudo (we run as root) so providers' `sudo ...` / asRoot paths work.
RUN printf '#!/bin/sh\nexec "$@"\n' > /usr/local/bin/sudo && chmod +x /usr/local/bin/sudo
# Install bun to run sysdef, symlinked onto PATH.
RUN curl -fsSL https://bun.com/install | bash && ln -sf /root/.bun/bin/bun /usr/local/bin/bun
