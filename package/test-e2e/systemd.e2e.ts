import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  SysdefContainer,
  dockerAvailable,
  serviceConfig,
  servicesModule,
} from "./harness";
import { systemdImage } from "./images";

// The systemd service provider is exercised against a real systemd booted as
// PID 1 inside a privileged container. We install a dummy unit and drive the
// full `sysdef sync` pipeline: enable (--now), idempotency, and disable-on-
// removal. Which services sysdef enabled is tracked in the (gitignored)
// trackfile, NOT the lockfile.

// This suite boots REAL systemd as PID 1 in a --privileged container. Even with
// a private cgroup namespace that is not something to run on a workstation by
// accident, so it is opt-in: set SYSDEF_E2E_SYSTEMD=1 (ideally in a disposable
// VM or CI, not your daily driver) to enable it.
const ENABLED = process.env.SYSDEF_E2E_SYSTEMD === "1";
const HAS_DOCKER = dockerAvailable();
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 10 * 60 * 1000;

const DUMMY_SERVICE = "sysdef-e2e-dummy";
const DUMMY_UNIT = `[Unit]
Description=sysdef e2e dummy service

[Service]
Type=oneshot
ExecStart=/bin/true
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
`;

describe.skipIf(!HAS_DOCKER || !ENABLED)("systemd service provider (e2e)", () => {
  let c: SysdefContainer;

  beforeAll(() => {
    const image = systemdImage();
    c = new SysdefContainer(image, "systemd", { systemd: true });
    c.start();

    // Lay down a unit with an [Install] section so `systemctl enable` has
    // something to link, then make systemd aware of it.
    c.writeFile(`/etc/systemd/system/${DUMMY_SERVICE}.service`, DUMMY_UNIT);
    const reload = c.exec("systemctl daemon-reload");
    expect(reload.code).toBe(0);
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  const isEnabled = (svc: string) => c.exec(`systemctl is-enabled ${svc}`).stdout.trim();
  const isActive = (svc: string) => c.exec(`systemctl is-active ${svc}`).stdout.trim();

  test("fresh enable via full `sync` pipeline", () => {
    c.writeConfig(serviceConfig("systemd", "svcs"));
    c.writeModule("svcs", servicesModule("svcs", "systemd", [DUMMY_SERVICE]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(isEnabled(DUMMY_SERVICE)).toBe("enabled");
    // --now started it too (oneshot + RemainAfterExit -> "active")
    expect(isActive(DUMMY_SERVICE)).toBe("active");
    // the managed set lives in the trackfile, not the lockfile
    const track = c.exec("cat /sysdef/sysdef-track.json");
    expect(track.stdout).toContain("systemd");
    expect(track.stdout).toContain(DUMMY_SERVICE);
  }, STEP_TIMEOUT);

  test("idempotency: re-running the same sync enables nothing new", () => {
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(res.stdout).not.toContain("ENABLING:");
    expect(isEnabled(DUMMY_SERVICE)).toBe("enabled");
  }, STEP_TIMEOUT);

  test("removal: emptying the module disables the managed service", () => {
    c.writeModule("svcs", servicesModule("svcs", "systemd", []));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(isEnabled(DUMMY_SERVICE)).not.toBe("enabled"); // "disabled"
    expect(isActive(DUMMY_SERVICE)).not.toBe("active"); // --now stopped it
  }, STEP_TIMEOUT);
});
