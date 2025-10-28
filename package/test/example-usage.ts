import { command } from './src/argparse';

// Example with strict typing
const cli = command('myapp', 'My CLI application')
  .argument('inputFile', { type: 'string', required: true, description: 'Input file path' })
  .argument('count', { type: 'number', description: 'Number of items' })
  .flag('verbose', { short: 'v', description: 'Verbose output' })
  .flag('debug', { type: 'boolean', description: 'Debug mode' })
  .option('output', { short: 'o', type: 'string', required: true, description: 'Output file' })
  .option('timeout', { type: 'number', description: 'Timeout in seconds' })
  .action(async (args) => {
    // Now args is fully typed!
    console.log(args.inputFile);  // string
    console.log(args.count);      // number | undefined
    console.log(args.verbose);    // boolean
    console.log(args.debug);      // boolean
    console.log(args.output);     // string
    console.log(args.timeout);    // number | undefined
    console.log(args._);          // string[]
    
    // TypeScript will error on non-existent properties
    // console.log(args.nonExistent); // ❌ TypeScript error
  });

// Subcommand example with typing
// Example with reusable flag sets
import { flagSet, optionSet, mixedSet } from './src/argparse';

// Create common flag sets that can be reused
const commonFlags = flagSet()
  .flag('verbose', { short: 'v', description: 'Verbose output' })
  .flag('debug', { description: 'Debug mode' })
  .flag('quiet', { short: 'q', description: 'Quiet mode' });

const outputOptions = optionSet()
  .option('output', { short: 'o', type: 'string', description: 'Output file' })
  .option('format', { type: 'string', description: 'Output format' });

const mixedCommon = mixedSet()
  .flag('force', { short: 'f', description: 'Force operation' })
  .option('config', { short: 'c', type: 'string', description: 'Config file' });

// Use the flag sets across multiple commands
const buildCommand = command('build')
  .use(commonFlags)      // Adds verbose, debug, quiet flags
  .use(outputOptions)    // Adds output, format options
  .argument('target', { required: true })
  .action(async (args) => {
    // All flags and options are typed!
    console.log(args.target);   // string
    console.log(args.verbose);  // boolean
    console.log(args.debug);    // boolean  
    console.log(args.quiet);    // boolean
    console.log(args.output);   // string | undefined
    console.log(args.format);   // string | undefined
  });

const subBuildCmd = cli.subcommand('build', 'Build the project')
  .argument('target', { type: 'string', required: true })
  .flag('watch', { short: 'w' })
  .option('config', { type: 'string', default: 'build.config.js' })
  .action(async (args) => {
    console.log(args.target);  // string
    console.log(args.watch);   // boolean
    console.log(args.config);  // string | undefined
  });

const deployCmd = command('deploy')
  .use(commonFlags)      // Same flags as build
  .use(mixedCommon)      // Adds force flag and config option
  .option('environment', { type: 'string', required: true })
  .action(async (args) => {
    console.log(args.verbose);     // boolean
    console.log(args.force);       // boolean
    console.log(args.config);      // string | undefined
    console.log(args.environment); // string
  });

export { cli, buildCommand, deployCmd };