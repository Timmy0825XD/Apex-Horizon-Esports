'use strict';

// HiddenCloud entrypoint. Upload this file once to the container root.
// Each boot fetches develop into ./apex-horizon, installs, builds, and starts the bot.
// Secrets come from apex-horizon/.env. That file is kept across clone and update.

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'apex-horizon');
const ENV_IN_APP = path.join(APP_DIR, '.env');
const ENV_STASH = path.join(ROOT, '.env.apex-horizon');
const DEFAULT_REPO = 'https://github.com/Timmy0825XD/Apex-Horizon-Esports.git';
const DEFAULT_BRANCH = 'develop';
const APP_ENV = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'ALLOWED_GUILDS', 'DATABASE_URL'];

function env(name, fallback = '') {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : fallback;
}

function redactArg(arg) {
  const text = String(arg);
  if (text.includes('extraHeader') || text.includes('AUTHORIZATION')) {
    return 'http.extraHeader=AUTHORIZATION: Basic ***';
  }
  return text.replace(/https:\/\/[^@\s]+@/g, 'https://***@');
}

function run(command, args, cwd) {
  console.log(`$ ${command} ${args.map(redactArg).join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GCM_INTERACTIVE: 'never',
    },
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}`);
  }
}

function assertCommand(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore', shell: false });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} is not available on this host.`);
  }
}

function assertNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isFinite(major) || major < 20) {
    throw new Error(`Node.js >= 20 is required. This host is running ${process.version}.`);
  }
}

function preserveEnv() {
  if (!fs.existsSync(ENV_IN_APP)) {
    return;
  }
  fs.copyFileSync(ENV_IN_APP, ENV_STASH);
}

function restoreEnv() {
  if (fs.existsSync(ENV_IN_APP) || !fs.existsSync(ENV_STASH)) {
    return;
  }
  fs.mkdirSync(APP_DIR, { recursive: true });
  fs.copyFileSync(ENV_STASH, ENV_IN_APP);
  console.log('Restored apex-horizon/.env');
}

function parseEnvFile(file) {
  const parsed = {};
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const body = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eq = body.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = body.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }
    let value = body.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function loadEnvFile() {
  if (!fs.existsSync(ENV_IN_APP)) {
    throw new Error('apex-horizon/.env was not found. Upload your .env into the apex-horizon folder and start again.');
  }
  const parsed = parseEnvFile(ENV_IN_APP);
  for (const [key, value] of Object.entries(parsed)) {
    if (!env(key) && value) {
      process.env[key] = value;
    }
  }
  console.log('Loaded apex-horizon/.env');
}

function assertAppEnv() {
  const missing = APP_ENV.filter((name) => !env(name));
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(', ')} in apex-horizon/.env.`);
  }
}

function gitRepoUrl() {
  return env('GIT_ADDRESS', DEFAULT_REPO);
}

function branchName() {
  const branch = env('BRANCH', env('INSTALL_BRANCH', DEFAULT_BRANCH));
  if (!/^[A-Za-z0-9._/-]+$/.test(branch)) {
    throw new Error(`Invalid git branch: ${branch}`);
  }
  return branch;
}

function gitAuthArgs() {
  const token = env('ACCESS_TOKEN');
  if (!token) {
    return [];
  }
  const user = env('USERNAME', 'x-access-token');
  const basic = Buffer.from(`${user}:${token}`).toString('base64');
  return ['-c', `http.extraHeader=AUTHORIZATION: Basic ${basic}`];
}

function git(args, cwd) {
  run('git', ['-c', `safe.directory=${APP_DIR}`, '-c', `safe.directory=${ROOT}`, ...gitAuthArgs(), ...args], cwd);
}

function hasApp() {
  return (
    fs.existsSync(path.join(APP_DIR, 'package.json')) &&
    fs.existsSync(path.join(APP_DIR, 'src', 'index.ts'))
  );
}

function isMusl() {
  try {
    const report = process.report?.getReport?.();
    return !report?.header?.glibcVersionRuntime;
  } catch {
    return false;
  }
}

function sharpNativePackage() {
  const { platform, arch } = process;
  if (platform === 'linux') {
    const libc = isMusl() ? 'linuxmusl' : 'linux';
    return `@img/sharp-${libc}-${arch}`;
  }
  if (platform === 'win32') {
    return `@img/sharp-win32-${arch}`;
  }
  if (platform === 'darwin') {
    return `@img/sharp-darwin-${arch}`;
  }
  return null;
}

function isInstalled(pkg) {
  return fs.existsSync(path.join(APP_DIR, 'node_modules', ...pkg.split('/')));
}

function rmDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function installDeps() {
  const native = sharpNativePackage();
  const modules = path.join(APP_DIR, 'node_modules');
  if (native && fs.existsSync(modules) && !isInstalled(native)) {
    console.log(`Missing ${native}. Reinstalling dependencies for ${process.platform}/${process.arch}...`);
    rmDir(modules);
  }

  run('npm', ['install', '--include=dev', '--include=optional', '--foreground-scripts'], APP_DIR);

  if (native && !isInstalled(native)) {
    console.log(`Installing ${native}...`);
    run('npm', ['install', native, '--include=optional', '--foreground-scripts'], APP_DIR);
  }
}

function printHead(branch) {
  const result = spawnSync('git', ['-c', `safe.directory=${APP_DIR}`, 'rev-parse', '--short', 'HEAD'], {
    cwd: APP_DIR,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status === 0) {
    console.log(`Checked out ${branch} @ ${result.stdout.trim()}`);
  }
}

function cloneOrUpdate() {
  preserveEnv();
  try {
    const repo = gitRepoUrl();
    const branch = branchName();
    const autoUpdate = env('AUTO_UPDATE', '1') === '1';

    if (!fs.existsSync(path.join(APP_DIR, '.git'))) {
      if (fs.existsSync(APP_DIR)) {
        console.log(`Removing ${APP_DIR} because it is not a git checkout.`);
        fs.rmSync(APP_DIR, { recursive: true, force: true });
      }
      console.log(`Cloning ${redactArg(repo)} (${branch})...`);
      git(['clone', '--depth', '1', '--no-single-branch', '--branch', branch, repo, APP_DIR], ROOT);
      printHead(branch);
      return;
    }

    if (!autoUpdate) {
      console.log('AUTO_UPDATE=0, keeping the checkout already on disk.');
      printHead(branch);
      return;
    }

    console.log(`Updating ${branch}...`);
    git(['remote', 'set-url', 'origin', repo], APP_DIR);
    git(
      ['fetch', '--depth', '1', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`],
      APP_DIR,
    );
    git(['checkout', '-f', '-B', branch, `origin/${branch}`], APP_DIR);
    printHead(branch);
  } finally {
    restoreEnv();
  }
}

function startBot() {
  installDeps();
  run('npm', ['run', 'build'], APP_DIR);
  const entry = path.join(APP_DIR, 'dist', 'index.js');
  if (!fs.existsSync(entry)) {
    throw new Error('Build finished but dist/index.js is missing.');
  }

  console.log('Starting dist/index.js');
  const child = spawn(process.execPath, ['dist/index.js'], {
    cwd: APP_DIR,
    env: process.env,
    stdio: 'inherit',
  });
  child.on('error', (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

try {
  assertNode();
  assertCommand('git');
  assertCommand('npm');
  cloneOrUpdate();
  if (!hasApp()) {
    throw new Error('Clone finished but package.json/src/index.ts are missing. Check GIT_ADDRESS and BRANCH.');
  }
  loadEnvFile();
  assertAppEnv();
  startBot();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
