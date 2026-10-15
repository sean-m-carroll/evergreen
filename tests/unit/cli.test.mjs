import { getNpmMinimumReleaseAge, loadConfig } from '../../src/config.mjs';
import { printReport } from '../../src/reporter.mjs';
import { runCheck } from '../../src/runner.mjs';
import { main } from '../../src/cli.mjs';

vi.mock('../../src/config.mjs', () => ({
  getNpmMinimumReleaseAge: vi.fn(),
  loadConfig: vi.fn(),
}));

vi.mock('../../src/reporter.mjs', () => ({
  printReport: vi.fn(),
}));

vi.mock('../../src/runner.mjs', () => ({
  runCheck: vi.fn(),
}));

describe('cli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds the default configuration from the loaded config and npm age', async () => {
    const baseConfig = { majorRules: { allow: [], disallow: [] } };
    loadConfig.mockReturnValue(baseConfig);
    getNpmMinimumReleaseAge.mockReturnValue(14);

    await expect(main(['--config', 'config.json'])).resolves.toStrictEqual({
      ...baseConfig,
      cooldownDaysOverride: 14,
      updatePackageJson: false,
      installUpdates: false,
      ignoreCooldownPatterns: [],
      majorRules: { allow: [], disallow: [] },
      colour: true,
    });

    expect(loadConfig).toHaveBeenCalledExactlyOnceWith('config.json');
    expect(getNpmMinimumReleaseAge).toHaveBeenCalledExactlyOnceWith(baseConfig);
    expect(runCheck).not.toHaveBeenCalled();
    expect(printReport).not.toHaveBeenCalled();
  });

  it('defaults missing major rule lists to empty arrays', async () => {
    const baseConfig = { majorRules: {} };
    loadConfig.mockReturnValue(baseConfig);
    getNpmMinimumReleaseAge.mockReturnValue(7);

    await expect(main([])).resolves.toMatchObject({
      majorRules: { allow: [], disallow: [] },
    });
  });

  it('preserves config values when CLI options are omitted', async () => {
    const baseConfig = {
      cooldownDaysOverride: 3,
      updatePackageJson: true,
      installUpdates: true,
      ignoreCooldownPatterns: [/^existing$/],
      majorRules: { allow: ['allowed'], disallow: ['blocked'] },
      colour: false,
    };
    loadConfig.mockReturnValue(baseConfig);
    getNpmMinimumReleaseAge.mockReturnValue(21);

    await expect(main([])).resolves.toStrictEqual({
      ...baseConfig,
      cooldownDaysOverride: 3,
      updatePackageJson: true,
      installUpdates: true,
      ignoreCooldownPatterns: baseConfig.ignoreCooldownPatterns,
      majorRules: { allow: ['allowed'], disallow: ['blocked'] },
      colour: false,
    });
  });

  it('uses CLI options to override config values', async () => {
    const baseConfig = {
      cooldownDaysOverride: 3,
      updatePackageJson: false,
      installUpdates: false,
      ignoreCooldownPatterns: [/^existing$/],
      majorRules: { allow: ['config-allowed'], disallow: ['config-blocked'] },
      colour: true,
    };
    loadConfig.mockReturnValue(baseConfig);
    getNpmMinimumReleaseAge.mockReturnValue(21);

    await expect(main([
      '--cooldown-days', '9',
      '--update-package-json',
      '--install-updates',
      '--ignore-pattern', '^@scope/',
      '--ignore-pattern', '^utility$',
      '--allow-major', 'new-major',
      '--allow-major', 'another-major',
      '--disallow-major', 'blocked-major',
      '--colour=false',
    ])).resolves.toMatchObject({
      cooldownDaysOverride: 9,
      updatePackageJson: true,
      installUpdates: true,
      majorRules: { allow: ['new-major', 'another-major'], disallow: ['blocked-major'] },
      colour: false,
    });

    const result = await main(['--ignore-pattern', '^@scope/']);
    expect(result.ignoreCooldownPatterns).toHaveLength(1);
    expect(result.ignoreCooldownPatterns[0]).toEqual(/^@scope\//);
  });

  it('runs the check and prints the report outside test mode', async () => {
    const baseConfig = { majorRules: { allow: [], disallow: [] } };
    const result = { packagesToUpdate: [], majorUpdates: [] };
    const vitestEnvironment = process.env.VITEST;
    loadConfig.mockReturnValue(baseConfig);
    getNpmMinimumReleaseAge.mockReturnValue(7);
    runCheck.mockResolvedValue(result);

    delete process.env.VITEST;
    try {
      await expect(main([])).resolves.toBeUndefined();
    } finally {
      process.env.VITEST = vitestEnvironment;
    }

    expect(runCheck).toHaveBeenCalledExactlyOnceWith({
      ...baseConfig,
      cooldownDaysOverride: 7,
      updatePackageJson: false,
      installUpdates: false,
      ignoreCooldownPatterns: [],
      majorRules: { allow: [], disallow: [] },
      colour: true,
    });
    expect(printReport).toHaveBeenCalledExactlyOnceWith(result);
  });

  it('logs errors and exits when configuration loading fails', async () => {
    const error = new Error('Cannot load config');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const processExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined);
    loadConfig.mockImplementation(() => {
      throw error;
    });

    await expect(main([])).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledExactlyOnceWith('Error:', error);
    expect(processExit).toHaveBeenCalledExactlyOnceWith(1);

    consoleError.mockRestore();
    processExit.mockRestore();
  });
});
