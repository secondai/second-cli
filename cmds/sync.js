const ora = require('ora')
const Rsync = require('rsync');
const path = require('path');
const chokidar = require('chokidar');
const { prompt } = require('enquirer');
const fs = require('fs-extra');
const exec = require('child_process').exec;
const _ = require('lodash');
const error = require('../utils/error');

const DEFAULT_REMOTE_PATH = '/usr/src/attached-volume/'; 

module.exports = async (args) => {

  let nodePaths = args.node || args.n;

  if(!nodePaths){
    error('Missing --node, -n like app.second.sample_app');
    return;
  }

  nodePaths = _.isArray(nodePaths) ? nodePaths:[nodePaths];
  
  for(let inputNodePath of nodePaths){
    if(inputNodePath.split('/').length > 1){
      error(`Do not include a slash in your app node path: "${inputNodePath}"`);
      return;
    }
  }

  if(!args.host){
    error('Missing --host like root@ipaddress');
    return;
  }
  let host = args.host;

  console.log('Default remote path is:', DEFAULT_REMOTE_PATH);

  // Confirm
  let answer;
  answer = await prompt({
    type: 'confirm',
    name: 'confirm',
    message: `Sync using unison`
  });
  if(!answer || !answer.confirm){
    return false;
  }


  console.log('Creating watchers');

  // create watchers
  for(let inputNodePath of nodePaths){
    startSyncForPath({
      inputNodePath,
      host
    });

  }


}

async function startSyncForPath(opts){

  let {
    inputNodePath,
    host
  } = opts;

  if(inputNodePath == 'all'){
    inputNodePath = null;
  }

  let cwd = inputNodePath ? path.join(process.cwd(), inputNodePath) : process.cwd();
  let remotePath = (inputNodePath ? (path.join(DEFAULT_REMOTE_PATH, inputNodePath) + '/') : DEFAULT_REMOTE_PATH);

  // UNISON (bidirectional, when using sync) 
  // - fails with "-o "StrictHostKeyChecking=no"" in the sshargs??
  let command = `unison ${cwd} ssh://${host}/${remotePath} -sshargs '-p 2222' -ignore 'Name node_modules' -ignore 'Name .DS_Store' -auto -batch -prefer ssh://${host}/${remotePath}`;

  console.log('Sync Command:', command);
  // return false;

  function runUnisonSync(){
    return new Promise((resolve)=>{
      // // Execute the command
      // rsync.execute(function(error, code, cmd) {
      //   console.log('Synced ', inputNodePath ,' Error:', error, 'ExitCode:', code); //, cmd);
      //   resolve();
      // });
      exec(command, (error, stdout, stderr)=>{
        console.log('exec output', error, stdout, stderr);
        resolve();
      })
    });
  }

  let toRun = true; // runs once at first
  // check for further runs 
  function checkToRunUnison(){
    if(toRun){
      toRun = false;
      runUnisonSync()
      .then(()=>{
        setTimeout(checkToRunUnison, 1000);
      });
    } else {
      setTimeout(checkToRunUnison,1000);
    }
  }

  let secondsBetweenRemoteChecks = 10;
  // watch for local changes 

  console.log('Watching for file changes');
  // const spinner = ora().start()
  // spinner.stop()

  chokidar.watch('.', {
    ignoreInitial: true,
    // ignored: ['node_modules', 'node_modules/**/*'],
    persistent: true,
    usePolling: true,
    interval: 5000, 
    binaryInterval: 5300, // ?
    depth: 10,
    followSymlinks: false,
    cwd: cwd
  }).on('all', (event, path) => {
    // console.log(event, path);
    // runSync();
    toRun = true;
    // console.log('check1');
  });
  checkToRunUnison();


  // check for remote changes every X (10) seconds 
  setInterval(()=>{
    // console.log('check2');
    toRun = true;
  }, secondsBetweenRemoteChecks * 1000);


}
