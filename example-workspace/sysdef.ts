#!/usr/bin/env bun

import { cli } from "./sysdef-src/index";

await cli.parse(process.argv);
