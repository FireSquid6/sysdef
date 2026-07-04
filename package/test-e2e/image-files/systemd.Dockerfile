FROM debian:stable-slim
ENV DEBIAN_FRONTEND=noninteractive container=docker
RUN apt-get update && apt-get install -y --no-install-recommends \
      systemd systemd-sysv curl ca-certificates unzip git xz-utils && \
    rm -rf /var/lib/apt/lists/*
# Fake sudo (we run as root) so providers' `sudo ...` / asRoot paths work.
RUN printf '#!/bin/sh\nexec "$@"\n' > /usr/local/bin/sudo && chmod +x /usr/local/bin/sudo
# Install bun to run sysdef, symlinked onto PATH.
RUN curl -fsSL https://bun.com/install | bash && ln -sf /root/.bun/bin/bun /usr/local/bin/bun
# Units that can't come up in an unprivileged-ish container -- mask them so the
# boot reaches a settled state quickly.
RUN systemctl mask systemd-udevd.service systemd-udev-trigger.service \
      systemd-modules-load.service sys-kernel-config.mount 2>/dev/null || true
# systemd expects this signal for a clean shutdown.
STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
