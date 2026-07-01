FROM archlinux:latest
RUN pacman -Sy --noconfirm --needed archlinux-keyring \
 && pacman -Syu --noconfirm --needed curl unzip git which sudo base-devel
# Install bun to run sysdef, symlinked onto PATH.
RUN curl -fsSL https://bun.com/install | bash && ln -sf /root/.bun/bin/bun /usr/local/bin/bun
