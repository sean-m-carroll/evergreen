import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { loadConfig, getNpmMinimumReleaseAge } from './config.mjs';
import { runCheck } from './runner.mjs';
import { printReport } from './reporter.mjs';

export async function main(args = hideBin(process.argv)) {
  try {
    const argv = yargs(args)
      .option('config', { type: 'string' })
      .option('update-package-json', { type: 'boolean' })
      .option('install-updates', { type: 'boolean' })
      .option('cooldown-days', { type: 'number' })
      .option('ignore-pattern', { type: 'array' })
      .option('allow-major', { type: 'array' })
      .option('disallow-major', { type: 'array' })
      .option('colour', { type: 'boolean' })
      .help()
      .parse();

    const baseConfig = loadConfig(argv.config);
    const npmCooldown = getNpmMinimumReleaseAge(baseConfig);

    const mergedConfig = {
      ...baseConfig,

      cooldownDaysOverride: argv.cooldownDays ?? baseConfig.cooldownDaysOverride ?? npmCooldown,

      updatePackageJson: argv.updatePackageJson ?? baseConfig.updatePackageJson ?? false,

      installUpdates: argv.installUpdates ?? baseConfig.installUpdates ?? false,

      ignoreCooldownPatterns: argv.ignorePattern
        ? argv.ignorePattern.map((p) => new RegExp(p))
        : (baseConfig.ignoreCooldownPatterns ?? []),

      majorRules: {
        allow: argv.allowMajor ?? baseConfig.majorRules.allow ?? [],
        disallow: argv.disallowMajor ?? baseConfig.majorRules.disallow ?? [],
      },

      colour: argv.colour ?? baseConfig.colour ?? true,
    };

    // ⭐ Correct test-mode detection
    const calledFromCliBinary = import.meta.url.includes('/bin/cli.mjs');
    if (process.env.VITEST && !calledFromCliBinary) {
      return mergedConfig;
    }

    // Normal CLI mode
    const result = await runCheck(mergedConfig);
    printReport(result);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}
