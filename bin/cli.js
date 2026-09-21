#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const PKG_ROOT = path.resolve(__dirname, '..');
const PKG = require(path.join(PKG_ROOT, 'package.json'));
const SKILLS_SRC = path.join(PKG_ROOT, 'skills');
const SKILLS_DEST = path.join(os.homedir(), '.claude', 'skills');
const MARKER = '.installed.json';

const USAGE = `Usage: goldengate-skills <command> [options]

Commands:
  list                 List available skills and their install status

Options:
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
