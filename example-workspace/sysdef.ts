#!/usr/bin/env bun

import { cli } from "./sysdef-src/index";

process.env.SYSDEF_ROOT_DIR = import.meta.dir;

await cli.parse(process.argv);
