import fs from 'fs';
import path from 'path';
import ncu from 'npm-check-updates';
import { execSync } from 'node:child_process';
import cooldownPeriod from './lib/cooldown.mjs';
import ncuConfig from './lib/ncu-config.mjs';
import { formatVersion } from './lib/version.mjs';

const filterMajor = ({ major, minor, patch }) => {
  return Object.fromEntries(
    Object.entries(major).filter(([name, version]) => {
      const inMinor = minor[name] === version;
      const inPatch = patch[name] === version;
      return !inMinor && !inPatch;
    }),
  );
};

const filterMinor = ({ minor, patch }) => {
  return Object.fromEntries(
    Object.entries(minor).filter(([name, version]) => {
      return !(patch[name] && patch[name] === version);
    }),
  );
};

const isMajorAllowed = () => {
  return false;
};

const readPackageJson = () => {
  const pkgPath = path.resolve('package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
};

export async function runCheck(config) {
  const pkg = readPackageJson();

  // 1️⃣ Patch versions
  const patchConfig = ncuConfig({ config, target: 'patch' });
  const patchSafe = await ncu(patchConfig);
  const patchVersions = patchSafe;

  // 2️⃣ Minor versions
  const minorConfig = ncuConfig({ config, target: 'minor' });
  const minorSafe = await ncu(minorConfig);
  const minorVersions = filterMinor({ patch: patchSafe, minor: minorSafe });

  // 3️⃣ Major versions
  const majorConfig = ncuConfig({ config });
  const majorSafe = await ncu(majorConfig);
  const majorVersions = filterMajor({ major: majorSafe, minor: minorSafe, patch: patchSafe });

  const packagesToUpdate = [];
  const majorUpdates = [];

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  for (const name of Object.keys(allDeps)) {
    const currentVersion = allDeps[name];

    let isMajor = Object.prototype.hasOwnProperty.call(majorVersions, name);
    let isMinor = Object.prototype.hasOwnProperty.call(minorVersions, name);
    let isPatch = Object.prototype.hasOwnProperty.call(patchVersions, name);

    // Determine appropriate version to update to
    let isFallback = false;
    let targetVersion = majorVersions[name] || minorVersions[name] || patchVersions[name];

    // If latest is major and not allowed → fallback
    if (isMajor && isMajorAllowed({ name }) === false) {
      targetVersion = minorVersions[name] || patchVersions[name];

      isFallback = true;
      isMajor = false;
      isMinor = Object.prototype.hasOwnProperty.call(minorVersions, name);
      isPatch = Object.prototype.hasOwnProperty.call(patchVersions, name);
    }

    const cooldown = cooldownPeriod({ config, name });

    let notes = '';
    notes = cooldown === 0 ? 'Cooldown ignored' : notes;
    notes = isFallback ? 'Fallback update' : notes;

    const entry = {
      cooldown,
      depType: pkg.dependencies?.[name] ? 'dependency' : 'devDependency',
      name,
      update: {
        isFallback,
        isMajor,
        isMinor,
        isPatch,
        notes,
      },
      versions: {
        current: currentVersion,
        major: majorVersions[name],
        minor: minorVersions[name],
        patch: patchVersions[name],
        target: targetVersion,
      },
    };

    if (isMajor || isMinor || isPatch) {
      packagesToUpdate.push(entry);
    }

    if (Object.prototype.hasOwnProperty.call(majorVersions, name)) {
      const majorEntry = JSON.parse(JSON.stringify(entry));
      majorEntry.update = {
        isFallback: false,
        isMajor: true,
        isMinor: false,
        isPatch: false,
        notes: 'Update blocked',
      };
      majorEntry.versions.target = majorEntry.versions.major;

      majorUpdates.push(majorEntry);
    }
  }

  if (config.update) {
    const pkgPath = path.resolve('package.json');
    const updated = { ...pkg };

    for (const p of packagesToUpdate) {
      if (p.depType === 'dependency') {
        updated.dependencies[p.name] = p.versions.target;
      } else {
        updated.devDependencies[p.name] = p.versions.target;
      }
    }

    fs.writeFileSync(pkgPath, JSON.stringify(updated, null, 2) + '\n');
  }

  if (config.install) {
    // for (const p of packagesToUpdate) {
    //   if (p.depType === 'dependency') {
    //     execSync(`npm i ${p.name} --min-release-age=${p.cooldown}`, { stdio: 'inherit' });
    //   } else {
    //     execSync(`npm i -D ${p.name} --min-release-age=${p.cooldown}`, { stdio: 'inherit' });
    //   }
    // }

    for (const p of packagesToUpdate) {
      try {
        if (p.depType === 'dependency') {
          execSync(`npm i ${p.name} --min-release-age=${p.cooldown}`, { stdio: 'ignore' });
        } else {
          execSync(`npm i -D ${p.name} --min-release-age=${p.cooldown}`, { stdio: 'ignore' });
        }

        // Success message
        console.log(
          `  \x1b[32m✓\x1b[0m ${p.name} ${formatVersion(p.versions.target)} successfully installed`,
        );
      } catch {
        // Failure message and script termination
        console.error(
          `  \x1b[31m✗\x1b[0m ${p.name} ${formatVersion(p.versions.target)} failed to install`,
        );
        process.exit(1);
      }
    }
  }

  return {
    cooldownDays: config.cooldownDaysOverride,
    colour: config.colour,
    packagesToUpdate,
    majorUpdates,
  };
}
