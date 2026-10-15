import fs from 'fs';
import ncu from 'npm-check-updates';
import cooldownPeriod from '../../src/lib/cooldown.mjs';
import ncuConfig from '../../src/lib/ncu-config.mjs';
import { runCheck } from '../../src/runner.mjs';
import { formatReport } from '../../src/reporter.mjs';

const fileEntry = (name) => ({ name, isFile: () => true, isDirectory: () => false });
const directoryEntry = (name) => ({ name, isFile: () => false, isDirectory: () => true });

const { execSyncMock } = vi.hoisted(() => ({
  execSyncMock: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
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
    fs.readdirSync.mockReturnValue([
      { name: 'package.json', isFile: () => true, isDirectory: () => false },
    ]);
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
      '/mnt/projects/evergreen/package.json',
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
      cwd: '/mnt/projects/evergreen',
    });
    expect(execSyncMock).toHaveBeenNthCalledWith(2, 'npm i -D devDependency --min-release-age=3', {
      stdio: 'ignore',
      cwd: '/mnt/projects/evergreen',
    });
    expect(consoleLog).toHaveBeenCalledTimes(2);
    consoleLog.mockRestore();
  });

  it('displays GitHub versions without changing dependency specifiers', async () => {
    const current = 'github:bbc/eslint-config-fabl#semver:^1.0.0';
    const target = 'github:bbc/eslint-config-fabl#semver:^1.0.1';
    fs.readFileSync.mockReturnValue(
      JSON.stringify({ devDependencies: { 'eslint-config-fabl': current } }),
    );
    ncu
      .mockResolvedValueOnce({ 'eslint-config-fabl': target })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runCheck({ update: true, install: true });

    expect(consoleLog).toHaveBeenCalledExactlyOnceWith(
      '  \x1b[32m✓\x1b[0m eslint-config-fabl ^1.0.1 successfully installed',
    );
    expect(result.packagesToUpdate[0].versions).toMatchObject({ current, target });
    expect(JSON.parse(fs.writeFileSync.mock.calls[0][1])).toStrictEqual({
      devDependencies: { 'eslint-config-fabl': target },
    });
    consoleLog.mockRestore();
  });

  it('checks, updates, and installs each manifest independently while skipping node_modules and symlinks', async () => {
    const root = '/mnt/projects/evergreen';
    const manifests = {
      [`${root}/package.json`]: { dependencies: { shared: '1.0.0' } },
      [`${root}/packages/a/package.json`]: { devDependencies: { shared: '3.0.0' } },
      [`${root}/packages/b/deep/package.json`]: { dependencies: { shared: '5.0.0' } },
    };
    const directories = {
      [root]: [
        directoryEntry('node_modules'),
        directoryEntry('packages'),
        fileEntry('package.json'),
        fileEntry('README.md'),
        { name: 'linked', isFile: () => false, isDirectory: () => false },
      ],
      [`${root}/packages`]: [directoryEntry('b'), directoryEntry('a')],
      [`${root}/packages/a`]: [fileEntry('package.json'), directoryEntry('node_modules')],
      [`${root}/packages/b`]: [directoryEntry('deep')],
      [`${root}/packages/b/deep`]: [fileEntry('package.json')],
    };
    fs.readdirSync.mockImplementation((directory) => {
      if (!(directory in directories)) throw new Error(`Unexpected traversal: ${directory}`);
      return directories[directory];
    });
    fs.readFileSync.mockImplementation((file) => JSON.stringify(manifests[file]));
    ncu.mockImplementation(async ({ packageFile, target }) => {
      const pkg = manifests[packageFile];
      const current = (pkg.dependencies ?? pkg.devDependencies).shared;
      return { shared: target ? current.replace(/0$/, '1') : `${Number(current[0]) + 1}.0.0` };
    });
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runCheck({ updatePackageJson: true, installUpdates: true, colour: false });

    expect(ncu).toHaveBeenCalledTimes(9);
    expect(fs.readdirSync.mock.calls.map(([directory]) => directory)).toStrictEqual([
      root,
      `${root}/packages`,
      `${root}/packages/a`,
      `${root}/packages/b`,
      `${root}/packages/b/deep`,
    ]);
    const files = Object.keys(manifests);
    expect(result.packagesToUpdate.map((entry) => entry.packageFile)).toStrictEqual(files);
    expect(result.majorUpdates.map((entry) => entry.packageFile)).toStrictEqual(files);
    for (const [index, file] of files.entries()) {
      const cwd = file.slice(0, file.lastIndexOf('/'));
      const pkg = manifests[file];
      const section = pkg.dependencies ? 'dependencies' : 'devDependencies';
      const current = pkg[section].shared;
      expect(ncu).toHaveBeenNthCalledWith(index * 3 + 1, {
        target: 'patch',
        packageFile: file,
        cwd,
      });
      expect(result.packagesToUpdate[index]).toMatchObject({
        versions: { current, target: current.replace(/0$/, '1') },
        update: { notes: `Fallback update; File: ${file.slice(root.length + 1)}` },
      });
      expect(fs.writeFileSync).toHaveBeenNthCalledWith(
        index + 1,
        file,
        `${JSON.stringify({ [section]: { shared: current.replace(/0$/, '1') } }, null, 2)}\n`,
      );
      expect(execSyncMock).toHaveBeenNthCalledWith(
        index + 1,
        `npm i ${section === 'devDependencies' ? '-D ' : ''}shared --min-release-age=7`,
        { stdio: 'ignore', cwd },
      );
      expect(formatReport(result)).toContain(`File: ${file.slice(root.length + 1)}`);
    }
    consoleLog.mockRestore();
  });

  it('checks nested manifests when the current directory has no package.json', async () => {
    fs.readdirSync
      .mockReturnValueOnce([directoryEntry('child')])
      .mockReturnValueOnce([fileEntry('package.json')]);
    fs.readFileSync.mockReturnValue(JSON.stringify({ dependencies: { dependency: '1.0.0' } }));
    ncu.mockResolvedValue({ dependency: '1.0.1' });

    const result = await runCheck({});

    expect(result.packagesToUpdate[0]).toMatchObject({
      packageFile: '/mnt/projects/evergreen/child/package.json',
      update: { notes: 'File: child/package.json' },
    });
    expect(ncu).toHaveBeenCalledWith({
      target: 'patch',
      packageFile: '/mnt/projects/evergreen/child/package.json',
      cwd: '/mnt/projects/evergreen/child',
    });
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(execSyncMock).not.toHaveBeenCalled();
  });

  it('reports an error when no package.json files are found', async () => {
    fs.readdirSync.mockReturnValue([directoryEntry('node_modules')]);

    await expect(runCheck({})).rejects.toThrow('No package.json files found');
    expect(ncu).not.toHaveBeenCalled();
  });

  it('propagates directory read errors', async () => {
    const error = new Error('Permission denied');
    fs.readdirSync.mockImplementation(() => {
      throw error;
    });

    await expect(runCheck({})).rejects.toBe(error);
    expect(ncu).not.toHaveBeenCalled();
  });

  it('propagates invalid manifest errors', async () => {
    fs.readFileSync.mockReturnValue('not json');

    await expect(runCheck({})).rejects.toThrow(SyntaxError);
    expect(ncu).not.toHaveBeenCalled();
  });

  it.each(['', 'github:bbc/eslint-config-fabl#semver:'])(
    'logs install failures and exits for version prefix "%s"',
    async (prefix) => {
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: { dependency: '1.0.0' },
        }),
      );
      ncu
        .mockResolvedValueOnce({ dependency: `${prefix}1.0.1` })
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
    },
  );
});
