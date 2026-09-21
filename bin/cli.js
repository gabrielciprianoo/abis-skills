#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const PKG_ROOT = path.resolve(__dirname, '..');
const PKG = require(path.join(PKG_ROOT, 'package.json'));
const SKILLS_SRC = path.join(PKG_ROOT, 'skills');
const SKILLS_DEST = path.join(os.homedir(), '.claude', 'skills');
const MARKER = '.installed.json';

const USAGE = `Usage: goldengate-skills <command> [options]

Commands:
  list                 List available skills and their install status
  install <skill>      Install a skill into ~/.claude/skills/<skill>/
  update <skill>       Overwrite an installed skill with this package's version
  uninstall <skill>    Remove an installed skill

Options:
  -f, --force          Overwrite or remove without asking for confirmation
  -h, --help           Show this help
  -v, --version        Show version`;

function parseArgs(argv) {
  const args = { command: null, positional: [], force: false, help: false, version: false };
  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') args.help = true;
    else if (arg === '-v' || arg === '--version') args.version = true;
    else if (arg === '-f' || arg === '--force') args.force = true;
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else if (!args.command) args.command = arg;
    else args.positional.push(arg);
  }
  return args;
}

function availableSkills() {
  if (!fs.existsSync(SKILLS_SRC)) return [];
  return fs
    .readdirSync(SKILLS_SRC, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(SKILLS_SRC, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort();
}

function installedInfo(skill) {
  const dir = path.join(SKILLS_DEST, skill);
  if (!fs.existsSync(dir)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, MARKER), 'utf8'));
  } catch {
    return {};
  }
}

function confirm(question) {
  if (!process.stdin.isTTY) return Promise.resolve(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

function requireSkill(args) {
  const [skill, ...extra] = args.positional;
  if (!skill) throw new Error(`missing skill name. Usage: goldengate-skills ${args.command} <skill>`);
  if (extra.length) throw new Error(`unexpected arguments: ${extra.join(' ')}`);
  if (!availableSkills().includes(skill)) {
    const list = availableSkills().join(', ') || '(none)';
    throw new Error(`skill "${skill}" does not exist in ${PKG.name}. Available: ${list}`);
  }
  return skill;
}

function isManaged(info) {
  return Boolean(info && info.package === PKG.name);
}

function copySkill(skill) {
  const dest = path.join(SKILLS_DEST, skill);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(SKILLS_DEST, { recursive: true });
  fs.cpSync(path.join(SKILLS_SRC, skill), dest, { recursive: true });
  const marker = { package: PKG.name, version: PKG.version, installedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(dest, MARKER), JSON.stringify(marker, null, 2) + '\n');
  return dest;
}

async function cmdInstall(args) {
  const skill = requireSkill(args);
  if (installedInfo(skill) && !args.force) {
    const ok = await confirm(`"${skill}" is already installed at ${path.join(SKILLS_DEST, skill)}. Overwrite?`);
    if (!ok) {
      console.log('Aborted. Nothing was changed.');
      return 1;
    }
  }
  const dest = copySkill(skill);
  console.log(`✓ Installed ${skill} (v${PKG.version}) at ${dest}`);
  console.log(`  Restart Claude Code, then run /${skill}.`);
  return 0;
}

function cmdUpdate(args) {
  const skill = requireSkill(args);
  const info = installedInfo(skill);
  if (!info) {
    throw new Error(`"${skill}" is not installed. Run: goldengate-skills install ${skill}`);
  }
  if (!isManaged(info)) {
    throw new Error(
      `${path.join(SKILLS_DEST, skill)} was not installed by ${PKG.name}. ` +
        `Run "goldengate-skills install ${skill} --force" to replace it.`
    );
  }
  const dest = copySkill(skill);
  console.log(`✓ Updated ${skill} v${info.version} → v${PKG.version} at ${dest}`);
  return 0;
}

async function cmdUninstall(args) {
  const [skill, ...extra] = args.positional;
  if (!skill) throw new Error('missing skill name. Usage: goldengate-skills uninstall <skill>');
  if (extra.length) throw new Error(`unexpected arguments: ${extra.join(' ')}`);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(skill)) throw new Error(`invalid skill name: "${skill}"`);

  const dest = path.join(SKILLS_DEST, skill);
  const info = installedInfo(skill);
  if (!info) throw new Error(`"${skill}" is not installed at ${dest}`);
  if (!isManaged(info)) {
    throw new Error(`${dest} was not installed by ${PKG.name}. Refusing to remove it.`);
  }
  if (!args.force) {
    const ok = await confirm(`Remove ${dest}?`);
    if (!ok) {
      console.log('Aborted. Nothing was changed.');
      return 1;
    }
  }
  fs.rmSync(dest, { recursive: true, force: true });
  console.log(`✓ Uninstalled ${skill} from ${dest}`);
  return 0;
}

function cmdList() {
  const skills = availableSkills();
  if (skills.length === 0) {
    console.log('No skills available in this package.');
    return;
  }
  console.log(`Skills in ${PKG.name}@${PKG.version}:\n`);
  for (const skill of skills) {
    const info = installedInfo(skill);
    let status = 'not installed';
    if (info) status = info.version ? `installed (v${info.version})` : 'installed (unmanaged)';
    console.log(`  ${skill.padEnd(20)} ${status}`);
  }
  console.log(`\nInstall location: ${SKILLS_DEST}`);
}

const COMMANDS = {
  list: cmdList,
  install: cmdInstall,
  update: cmdUpdate,
  uninstall: cmdUninstall,
};

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}\n\n${USAGE}`);
    return 1;
  }

  if (args.version) {
    console.log(PKG.version);
    return 0;
  }
  if (args.help || !args.command) {
    console.log(USAGE);
    return args.command || args.help ? 0 : 1;
  }

  const handler = COMMANDS[args.command];
  if (!handler) {
    console.error(`Error: unknown command "${args.command}"\n\n${USAGE}`);
    return 1;
  }

  try {
    return (await handler(args)) ?? 0;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return 1;
  }
}

main().then((code) => process.exit(code));
