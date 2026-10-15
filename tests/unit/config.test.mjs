import fs from 'fs';
import path from 'path';
import { getNpmMinimumReleaseAge, loadConfig } from '../../src/config.mjs';

vi.mock('fs', () => ({
  default: { readFileSync: vi.fn() },
}));

describe('evergreen config', () => {
  beforeEach(() => {
    fs.readFileSync.mockReset();
  });

  describe('loadConfig', () => {
    it('reads the resolved config path as UTF-8 and supplies defaults', () => {
      fs.readFileSync.mockReturnValue('{}');

      expect(loadConfig('config.json')).toStrictEqual({
        majorRules: { allow: [], disallow: [] },
        cooldownDaysOverride: 7,
        npmMinimumReleaseAge: 7,
      });
      expect(fs.readFileSync).toHaveBeenCalledExactlyOnceWith(path.resolve('config.json'), 'utf8');
    });

    it('preserves valid settings and unrelated properties', () => {
      const config = {
        majorRules: { allow: ['allowed'], disallow: ['blocked'] },
        cooldownDaysOverride: 3,
        npmMinimumReleaseAge: 14,
        registry: 'https://registry.npmjs.org',
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(config));

      expect(loadConfig('config.json')).toStrictEqual(config);
    });

    it.each([null, false, 1, 'invalid'])('replaces invalid majorRules: %j', (majorRules) => {
      fs.readFileSync.mockReturnValue(JSON.stringify({ majorRules }));

      expect(loadConfig('config.json').majorRules).toStrictEqual({
        allow: [],
        disallow: [],
      });
    });

    it.each([undefined, null, false, 1, 'invalid', {}])(
      'replaces invalid rule lists: %j',
      (value) => {
        fs.readFileSync.mockReturnValue(
          JSON.stringify({
            majorRules: { allow: value, disallow: value },
          }),
        );

        expect(loadConfig('config.json').majorRules).toStrictEqual({
          allow: [],
          disallow: [],
        });
      },
    );

    it.each([null, false, '3', [], {}])('defaults nonnumeric age settings: %j', (value) => {
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          cooldownDaysOverride: value,
          npmMinimumReleaseAge: value,
        }),
      );

      expect(loadConfig('config.json')).toMatchObject({
        cooldownDaysOverride: 7,
        npmMinimumReleaseAge: 7,
      });
    });

    it('preserves zero age settings', () => {
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          cooldownDaysOverride: 0,
          npmMinimumReleaseAge: 0,
        }),
      );

      expect(loadConfig('config.json')).toMatchObject({
        cooldownDaysOverride: 0,
        npmMinimumReleaseAge: 0,
      });
    });

    it('propagates file read errors', () => {
      const error = new Error('Cannot read config');
      fs.readFileSync.mockImplementation(() => {
        throw error;
      });

      expect(() => loadConfig('config.json')).toThrow(error);
    });

    it('rejects invalid JSON', () => {
      fs.readFileSync.mockReturnValue('{');

      expect(() => loadConfig('config.json')).toThrow(SyntaxError);
    });
  });

  describe('getNpmMinimumReleaseAge', () => {
    it.each([0, 7, 14])('returns the configured release age: %i', (npmMinimumReleaseAge) => {
      expect(getNpmMinimumReleaseAge({ npmMinimumReleaseAge })).toBe(npmMinimumReleaseAge);
    });
  });
});
