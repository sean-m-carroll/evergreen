import { formatVersion } from './lib/version.mjs';

const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

const alignText = ({ column, text }) => {
  let colourCorrection = 0;

  if (column === 1) {
    return text.padEnd(30);
  } else if (column === 5) {
    return text;
  }

  // Outputting coloured test changes the length of the string
  if (column === 3 && text !== 'Available') {
    colourCorrection = 9;
  } else if (column === 4) {
    colourCorrection = -1;
  }

  return `${text.padStart(9 + colourCorrection)}   `;
};

const header = () => {
  let line = alignText({ column: 1, text: 'Package' });
  line += alignText({ column: 2, text: 'Installed' });
  line += alignText({ column: 3, text: 'Available' });
  line += alignText({ column: 4, text: 'Cooldown' });
  line += alignText({ column: 5, text: 'Notes' });

  return line;
};

const row = ({ p, result }) => {
  const coloured = colourVersion(p.update, formatVersion(p.versions.target), result.colour);
  const cooldown = `${p.cooldown}d`;

  let line = alignText({ column: 1, text: p.name });
  line += alignText({ column: 2, text: formatVersion(p.versions.current) });
  line += alignText({ column: 3, text: coloured });
  line += alignText({ column: 4, text: cooldown });
  line += alignText({ column: 5, text: p.update.notes });

  return line;
};

const colourVersion = (update, version, enableColour) => {
  if (!enableColour) return version;
  if (update.isMajor) return `${RED}${version}${RESET}`;
  if (update.isMinor) return `${CYAN}${version}${RESET}`;
  if (update.isPatch) return `${GREEN}${version}${RESET}`;
  if (update.isFallback) return `${GREEN}${version}${RESET}`;

  return version;
};

export function formatReport(result) {
  const lines = [];

  lines.push(header());

  lines.push('-'.repeat(80));

  if (result.packagesToUpdate.length === 0) {
    lines.push('No packages eligible for update.');
  } else {
    for (const p of result.packagesToUpdate) {
      lines.push(row({ p, result }));
    }
  }

  lines.push('');
  lines.push('Major updates:');
  lines.push('-'.repeat(80));

  if (result.majorUpdates.length === 0) {
    lines.push('None');
  } else {
    for (const p of result.majorUpdates) {
      lines.push(row({ p, result }));
    }
  }

  return lines.join('\n');
}

export function printReport(result) {
  const report = `\n${formatReport(result)}\n\n`;
  console.log(report);
}
