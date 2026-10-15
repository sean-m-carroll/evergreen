import ncuConfig from '../../../src/lib/ncu-config.mjs';

vi.mock('../../../src/lib/cooldown.mjs', () => ({
  default: () => 0,
}));

describe('npm-check-update config', () => {
  it('...', () => {
    const result = ncuConfig();

    expect(result).toStrictEqual({
      cooldown: expect.any(Function),
      deprecated: false,
      packageFile: '/mnt/projects/check-updates/package.json',
      removeRange: true,
    });

    // Would like to remove the need for this
    expect(result.cooldown('some-package')).toBe(0);
  });

  it('can target patch updates', () => {
    const result = ncuConfig({ target: 'patch' });

    expect(result).toStrictEqual({
      cooldown: expect.any(Function),
      deprecated: false,
      packageFile: '/mnt/projects/check-updates/package.json',
      removeRange: true,
      target: 'patch',
    });
  });

  it('can target minor updates', () => {
    const result = ncuConfig({ target: 'minor' });

    expect(result).toStrictEqual({
      cooldown: expect.any(Function),
      deprecated: false,
      packageFile: '/mnt/projects/check-updates/package.json',
      removeRange: true,
      target: 'minor',
    });
  });
});
