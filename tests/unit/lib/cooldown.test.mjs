import cooldown from '../../../src/lib/cooldown.mjs';

describe('cooldown', () => {
  it('returns the default cooldown period from config', () => {
    const config = {
      cooldown: 5,
      ignoreCooldown: [],
    }

    const result = cooldown({ config, name: 'tester' });

    expect(result).toStrictEqual(5);
  });

  it('returns the default cooldown period from config when ignoreCooldown is not set', () => {
    const config = {
      cooldown: 5,
    }

    const result = cooldown({ config, name: 'tester' });

    expect(result).toStrictEqual(5);
  });

  it('ignores cooldown when package name matches an ignoreCooldown rule', () => {
    const config = {
      cooldown: 5,
      ignoreCooldown: ['^@4t2/'],
    }

    const result = cooldown({ config, name: '@4t2/tester' });

    expect(result).toStrictEqual(0);
  });

  it('returns the default cooldown period from config when package name does not match an ignoreCooldown rule', () => {
    const config = {
      cooldown: 5,
      ignoreCooldown: ['^@demo/'],
    }

    const result = cooldown({ config, name: '@4t2/tester' });

    expect(result).toStrictEqual(5);
  });
});
