#!/usr/bin/env bun

import { cli } from "./sysdef-src/index";

const args = process.argv;
args.shift();
args.shift();

await cli.execute(args);
