FROM archlinux:latest
RUN pacman -Sy --noconfirm --needed archlinux-keyring \
 && pacman -Syu --noconfirm --needed curl unzip git which sudo base-devel
# Install bun to run sysdef. Copy (not symlink) onto PATH so the non-root
# `builder` user can run it too (it can't read into /root/.bun).
RUN curl -fsSL https://bun.com/install | bash && install -m 0755 /root/.bun/bin/bun /usr/local/bin/bun
# makepkg refuses to run as root, so the aur provider needs a non-root user with
# passwordless sudo (the aur e2e runs as this user).
RUN useradd -m builder \
 && echo 'builder ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/builder \
 && chmod 0440 /etc/sudoers.d/builder
