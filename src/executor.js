import { spawn, execFileSync } from "child_process";
import logger from "testarmada-logger";
import path from 'path';
import settings from "./settings";

export default {
  /*eslint-disable no-unused-vars*/
  setupRunner: (mocks = null) => {
    return new Promise((resolve) => {
      resolve();
    });
  },

  /*eslint-disable no-unused-vars*/
  teardownRunner: (mocks = null) => {
    return new Promise((resolve) => {
      resolve();
    });
  },

  setupTest: (callback) => {
    callback();
  },

  teardownTest: (info, callback) => {
    callback();
  },

  execute: (testRun, options, mocks = null) => {
    logger.prefix = "CircleCI Executor";

    let ispawnSync = execFileSync;
    let ispawn = spawn;

    if (mocks && mocks.fork) {
      ispawnSync = mocks.fork;
      ispawn = mocks.fork;
    }

    const nodeIndex = Number(settings.config.firstNode) + Number(testRun.workerIndex) - 1; // workerIndex is one based
    const fullPath = path.resolve(testRun.tempAssetPath);

    // No IPC via SSH
    const sshOptions = Object.assign({}, options, { stdio: ['pipe', 'pipe', 'pipe' ] });

    const mkdirOutput = ispawnSync('ssh',
      [`node${nodeIndex}`, 'mkdir', '-p', fullPath],
      sshOptions);
    logger.log(mkdirOutput);

    const copyOutput = ispawnSync('rsync', [
        '-rpt', '-z', '-vv', '--delete',
        '-e', 'ssh -Tx -c aes128-ctr -o Compression=no',
        fullPath, `node${nodeIndex}:"${fullPath}/.."`],
      sshOptions);
    logger.log(copyOutput);

    let remoteArgs = ['-xC', '-c', 'aes128-ctr', `node${nodeIndex}`, '--'];
    const runPath = path.resolve('.');
    remoteArgs = remoteArgs.concat(['cd', runPath, ';']);

    settings.config.exportedEnvVars.forEach(env => {
      const varName = env.toUpperCase();
      const value = (typeof process.env[varName] === undefined) ? '' : process.env[varName];
      remoteArgs = remoteArgs.concat(['export', `"${varName}"="${value}"`, ';']);
    });

    remoteArgs.push(testRun.getCommand());
    remoteArgs.push( '"'+testRun.getArguments().join('" "') + '"' );
    logger.log(remoteArgs);

    return ispawn('ssh', remoteArgs, sshOptions);
  },

  summerizeTest: (magellanBuildId, testResult, callback) => {
    callback();
  }
};
