import { formatReport, printReport } from '../../src/reporter.mjs';

const packageEntry = (name, update, target = '2.0.0') => ({
  cooldown: 7,
  name,
  update: {
    isFallback: false,
    isMajor: false,
    isMinor: false,
    isPatch: false,
    notes: '',
    ...update,
  },
  versions: {
    current: '1.0.0',
    target,
  },
});

describe('reporter', () => {
  it('formats a report with no eligible or major updates', () => {
    const report = formatReport({
      colour: true,
      packagesToUpdate: [],
      majorUpdates: [],
    });

    expect(report).toContain('Package');
    expect(report).toContain('Installed');
    expect(report).toContain('Available');
    expect(report).toContain('Cooldown');
    expect(report).toContain('Notes');
    expect(report).toContain('-'.repeat(80));
    expect(report).toContain('No packages eligible for update.');
    expect(report).toContain('Major updates:');
    expect(report).toContain('None');
  });

  it('formats all update types with their corresponding colors', () => {
    const report = formatReport({
      colour: true,
      packagesToUpdate: [
        packageEntry('major-package', { isMajor: true }),
        packageEntry('minor-package', { isMinor: true }),
        packageEntry('patch-package', { isPatch: true }),
        packageEntry('fallback-package', { isFallback: true }),
        packageEntry('plain-package', {}, 'Available'),
      ],
      majorUpdates: [
        packageEntry('blocked-package', { isMajor: true, notes: 'Update blocked' }),
      ],
    });

    expect(report).toContain('\x1b[31m2.0.0\x1b[0m');
    expect(report).toContain('\x1b[36m2.0.0\x1b[0m');
    expect(report).toContain('\x1b[32m2.0.0\x1b[0m');
    expect(report).toContain('major-package');
    expect(report).toContain('blocked-package');
    expect(report).toContain('Update blocked');
  });

  it('formats versions without color when color is disabled', () => {
    const report = formatReport({
      colour: false,
      packagesToUpdate: [packageEntry('plain-package', { isMajor: true })],
      majorUpdates: [],
    });

    expect(report).toContain('plain-package');
    expect(report).toContain('2.0.0');
    expect(report).not.toContain('\x1b[31m');
  });

  it('prints the formatted report with surrounding newlines', () => {
    const result = {
      colour: true,
      packagesToUpdate: [],
      majorUpdates: [],
    };
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    printReport(result);

    expect(consoleLog).toHaveBeenCalledExactlyOnceWith(`\n${formatReport(result)}\n\n`);
    consoleLog.mockRestore();
  });
});
