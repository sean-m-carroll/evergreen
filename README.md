# Evergreen

A Node.js CLI tool that checks your project’s dependencies using **[npm-check-updates](https://github.com/raineorshine/npm-check-updates)**, applies **cooldown rules**, enforces **major‑update policies**, and prints a **colour‑coded, column‑formatted report** showing which packages can be safely updated.


## Requirements

- **Node.js:** `^22.22.2 || ^24.15.0 || >=26.0.0`
- **npm:** `>=10.0.0`


## 📦 Installation

#### Global install

```bash
npm install -g @4t2/evergreen
```

Run globally:
```bash
evergreen
```

#### Local install
```bash
npm install @4t2/evergreen
```

Run locally:
```bash
npx evergreen
```


## 🚀 Usage

#### Basic usage
```
evergreen
```

#### With flags
```
evergreen --cooldown-days 7 --update-package-json
```

#### With a config file
```
evergreen --config evergreen.config.json
```


## ⚙️ Configuration Options
You can configure the tool using:
 - CLI flags
 - A JSON config file
 - npm config (minimum-release-age)
 - Defaults


Below are all supported options.

***

`cooldownDaysOverride`

Number of days a new version must exist before being eligible for update.
Overrides npm’s `minimum-release-age`.

***

`ignoreCooldownPatterns`

Array of regex patterns.
Packages matching these patterns **ignore cooldown rules**.

Example:
```json
"ignoreCooldownPatterns": ["^eslint", ".*-beta$"]
```

***

`updatePackageJson`

If `true`, updated versions are written into your `package.json`.

***

`installUpdates`

If `true`, runs `npm install` after updating `package.json`.

***

`majorRules.allow`

Packages allowed to receive major updates.

Example:
```json
"majorRules": {
  "allow": ["typescript"]
}
```

***

`majorRules.disallow`

Packages blocked from major updates.

Example:
```json
"majorRules": {
  "disallow": ["react"]
}
```

***

`colour`

Enable or disable colour output in the report.

CLI flag:
```bash
--no-colour
```

Config file:
```json
"colour": false
```

Useful for CI environments where ANSI colours are stripped.


## 📄 Example Config File
Save as `evergreen.config.json`:
```json
{
  "cooldownDaysOverride": 10,
  "ignoreCooldownPatterns": ["^eslint", "^vitest"],
  "updatePackageJson": true,
  "installUpdates": false,
  "majorRules": {
    "allow": ["typescript"],
    "disallow": ["react"]
  },
  "colour": true
}
```

Use it:
```bash
evergreen --config evergreen.config.json
```


## 📊 Report Format
The report displays a table with:
 - **Package name**
 - **Installed version**
 - **Available version**
 - **Cooldown**
 - **Notes**

For GitHub semver dependencies, reports and install messages show only the version
(for example, `github:org/name#semver:^1.0.0` is displayed as `^1.0.0`).
The full dependency specifier is preserved when updating `package.json`.

Updated versions are colour‑coded:
 - **Red** → major update
 - **Cyan** → minor update
 - **Green** → patch update

Disable colours:
```bash
evergreen --no-colour
```


## 🧪 Testing

Run all tests:
```bash
npm test
```

Update snapshots:
```bash
npm test -- --update
```


## 🔧 Local Development

Link globally:
```bash
npm link
```

Run CLI:
```bash
evergreen
```

Useful for testing before publishing.


## 📁 Project Goals

 - Enforce safe dependency updates
 - Prevent accidental major upgrades
 - Respect release cooldowns
 - Provide clear, readable reports
 - Integrate cleanly with CI


<!-- {
  "majorRules": {
    "allow": ["^react", "^@types/"],
    "disallow": ["^eslint", "^vitest"]
  }
} -->
