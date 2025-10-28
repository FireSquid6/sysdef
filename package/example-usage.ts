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
const buildCmd = cli.subcommand('build', 'Build the project')
  .argument('target', { type: 'string', required: true })
  .flag('watch', { short: 'w' })
  .option('config', { type: 'string', default: 'build.config.js' })
  .action(async (args) => {
    console.log(args.target);  // string
    console.log(args.watch);   // boolean
    console.log(args.config);  // string | undefined
  });

export { cli };