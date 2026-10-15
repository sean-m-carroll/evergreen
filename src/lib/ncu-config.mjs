import path from 'node:path';
import cooldown from './cooldown.mjs';

export default ({ config = {}, target = null } = {}) => ({
  cooldown: (packageName) => cooldown({ config, name: packageName }),
  deprecated: false, // Exclude deprecated packages
  packageFile: path.resolve('package.json'),
  removeRange: true, // Remove version ranges from the final package version.
  ...(target && ['minor', 'patch'].includes(target) && { target: target }),
});
