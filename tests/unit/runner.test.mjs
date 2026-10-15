import fs from 'fs';
import ncu from 'npm-check-updates';
import cooldownPeriod from '../../src/lib/cooldown.mjs';
import ncuConfig from '../../src/lib/ncu-config.mjs';
import { runCheck } from '../../src/runner.mjs';

const { execSyncMock } = vi.hoisted(() => ({
  execSyncMock: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

vi.mock('npm-check-updates', () => ({
  default: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  default: { execSync: execSyncMock },
  execSync: execSyncMock,
}));

vi.mock('../../src/lib/cooldown.mjs', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/lib/ncu-config.mjs', () => ({
  default: vi.fn(),
}));

describe('runCheck', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fs.readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: {},
        devDependencies: {},
      }),
    );
    ncuConfig.mockImplementation(({ target } = {}) => ({ target }));
    cooldownPeriod.mockReturnValue(7);
  });

  it('checks patch, minor, and major updates and returns eligible packages', async () => {
    const pkg = {
      dependencies: {
        patch: '1.0.0',
        minor: '1.0.0',
        major: '1.0.0',
        unchanged: '1.0.0',
      },
      devDependencies: {
        devPatch: '1.0.0',
      },
    };
    fs.readFileSync.mockReturnValue(JSON.stringify(pkg));
    ncu
      .mockResolvedValueOnce({ patch: '1.0.1', shared: '1.0.1' })
      .mockResolvedValueOnce({ minor: '1.1.0', shared: '1.0.1' })
      .mockResolvedValueOnce({ major: '2.0.0', minor: '1.1.0', patch: '1.0.1' });
    cooldownPeriod.mockImplementation(({ name }) => (name === 'patch' ? 0 : 7));

    const result = await runCheck({ cooldownDaysOverride: 7, colour: false });

    expect(ncuConfig).toHaveBeenNthCalledWith(1, {
      config: { cooldownDaysOverride: 7, colour: false },
      target: 'patch',
    });
    expect(ncuConfig).toHaveBeenNthCalledWith(2, {
      config: { cooldownDaysOverride: 7, colour: false },
      target: 'minor',
    });
    expect(ncuConfig).toHaveBeenNthCalledWith(3, {
      config: { cooldownDaysOverride: 7, colour: false },
    });
    expect(ncu).toHaveBeenCalledTimes(3);
    expect(result).toStrictEqual({
      cooldownDays: 7,
      colour: false,
      packagesToUpdate: [
        {
          cooldown: 0,
          depType: 'dependency',
          name: 'patch',
          update: {
            isFallback: false,
            isMajor: false,
            isMinor: false,
            isPatch: true,
            notes: 'Cooldown ignored',
          },
          versions: {
            current: '1.0.0',
            major: undefined,
            minor: undefined,
            patch: '1.0.1',
            target: '1.0.1',
          },
        },
        {
          cooldown: 7,
          depType: 'dependency',
          name: 'minor',
          update: {
            isFallback: false,
            isMajor: false,
            isMinor: true,
            isPatch: false,
            notes: '',
          },
          versions: {
            current: '1.0.0',
            major: undefined,
            minor: '1.1.0',
            patch: undefined,
            target: '1.1.0',
          },
        },
      ],
      majorUpdates: [
        {
          cooldown: 7,
          depType: 'dependency',
          name: 'major',
          update: {
            isFallback: false,
            isMajor: true,
            isMinor: false,
            isPatch: false,
            notes: 'Update blocked',
          },
          versions: {
            current: '1.0.0',
            major: '2.0.0',
            target: '2.0.0',
          },
        },
      ],
    });
  });

  it('falls back major updates to a minor or patch version', async () => {
    fs.readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: { fallback: '1.0.0' },
      }),
    );
    ncu
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ fallback: '1.1.0' })
      .mockResolvedValueOnce({ fallback: '2.0.0' });

    const result = await runCheck({ cooldown: 5, cooldownDaysOverride: 5, colour: true });

    expect(result.packagesToUpdate[0]).toMatchObject({
      name: 'fallback',
      update: {
        isFallback: true,
        isMajor: false,
        isMinor: true,
        isPatch: false,
        notes: 'Fallback update',
      },
      versions: {
        major: '2.0.0',
        minor: '1.1.0',
        target: '1.1.0',
      },
    });
    expect(result.majorUpdates[0]).toMatchObject({
      name: 'fallback',
      update: { isMajor: true, notes: 'Update blocked' },
      versions: { target: '2.0.0' },
    });
  });

  it('writes updated dependency and devDependency versions when requested', async () => {
    const pkg = {
      dependencies: { dependency: '1.0.0' },
      devDependencies: { devDependency: '1.0.0' },
    };
    fs.readFileSync.mockReturnValue(JSON.stringify(pkg));
    ncu
      .mockResolvedValueOnce({ dependency: '1.0.1', devDependency: '1.0.1' })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await runCheck({ update: true, cooldownDaysOverride: 7, colour: true });

    expect(fs.writeFileSync).toHaveBeenCalledExactlyOnceWith(
      '/mnt/projects/check-updates/package.json',
      `${JSON.stringify(
        {
          dependencies: { dependency: '1.0.1' },
          devDependencies: { devDependency: '1.0.1' },
        },
        null,
        2,
      )}\n`,
    );
  });

  it('installs dependency and devDependency updates successfully', async () => {
    const pkg = {
      dependencies: { dependency: '1.0.0' },
      devDependencies: { devDependency: '1.0.0' },
    };
    fs.readFileSync.mockReturnValue(JSON.stringify(pkg));
    ncu
      .mockResolvedValueOnce({ dependency: '1.0.1', devDependency: '1.0.1' })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    cooldownPeriod.mockReturnValue(3);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runCheck({ install: true, cooldown: 3, cooldownDaysOverride: 3, colour: true });

    expect(execSyncMock).toHaveBeenNthCalledWith(1, 'npm i dependency --min-release-age=3', {
      stdio: 'ignore',
    });
    expect(execSyncMock).toHaveBeenNthCalledWith(2, 'npm i -D devDependency --min-release-age=3', {
      stdio: 'ignore',
    });
    expect(consoleLog).toHaveBeenCalledTimes(2);
    consoleLog.mockRestore();
  });

  it('logs install failures and exits', async () => {
    fs.readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: { dependency: '1.0.0' },
      }),
    );
    ncu
      .mockResolvedValueOnce({ dependency: '1.0.1' })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    const error = new Error('install failed');
    execSyncMock.mockImplementation(() => {
      throw error;
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const processExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined);

    const result = await runCheck({
      install: true,
      cooldown: 3,
      cooldownDaysOverride: 3,
      colour: true,
    });

    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      '  \x1b[31m✗\x1b[0m dependency 1.0.1 failed to install',
    );
    expect(processExit).toHaveBeenCalledExactlyOnceWith(1);
    expect(result.packagesToUpdate).toHaveLength(1);

    consoleError.mockRestore();
    processExit.mockRestore();
  });
});
