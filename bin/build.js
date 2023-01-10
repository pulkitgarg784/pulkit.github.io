const path = require('path');
const spawn = require('child_process').spawn;
const fs = require('fs-extra');

const APP_DIR = path.resolve(__dirname, '../_harp');
const BUILD_DIR = path.resolve(__dirname, '../build');
const ROOT = path.resolve(__dirname, '../');

const whitelist = new Set([
  'node_modules',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'build',
  '_harp',
  'bin',
  'CNAME',
]);

// Remove everything that isn't whitelisted or hidden.
function clearRoot(andThen) {
  fs.readdir(ROOT, (err, contents) => {
    if (err) {
      console.error(err);
      return;
    }
    const keepFile = file => file.indexOf('.') === 0 || whitelist.has(file);
    const deletePromises = contents
      .filter(file => !keepFile(file))
      .map(file => fs.remove(path.resolve(ROOT, file)));

    Promise.all(deletePromises)
      .then(() => console.log('Deleted all other files'))
      .then(andThen)
      .catch(err => console.error(err));
  });
}

function build(andThen) {
  const cmd = path.resolve(__dirname, '../node_modules/.bin/harp');
  const args = [APP_DIR, BUILD_DIR];
  const proc = spawn(cmd, args);
  proc.stdout.on('data', data => console.log(`${data}`));
  proc.stderr.on('data', data => console.log(`stderr: ${data}`));
  proc.on('close', code => {
    console.log(`Finished building ${code}`);
    andThen();
  });
  proc.on('error', error => {
    if (error.code == 'ENOENT') {
      console.log(`Hmm, could not find the path ${cmd}.`);
      return;
    }
    console.log(error);
  });
}

function copyBuild() {
  // Copy recursively from build directory.
  fs.readdir(BUILD_DIR, (err, contents) => {
    if (err) {
      console.error(err);
      return;
    }

    const copyPromises = contents.map(file => {
      const from = path.resolve(BUILD_DIR, file);
      const to = path.resolve(ROOT, file);
      return fs.move(from, to, { overwrite: true });
    });

    Promise.all(copyPromises)
      .then(() => console.log('Copied build to root'))
      .catch(err => console.error(err));
  });
}

clearRoot(build(copyBuild));
