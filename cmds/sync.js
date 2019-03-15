const ora = require('ora')
const Rsync = require('rsync');
const path = require('path');
const chokidar = require('chokidar');
const { prompt } = require('enquirer');
const fs = require('fs-extra');
const _ = require('lodash');
const error = require('../utils/error');

const DEFAULT_REMOTE_PATH = '/usr/src/attached-volume/';

module.exports = async (direction, args) => {

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

  // Confirm
  let answer;
  if(direction == 'local-to-remote'){

    answer = await prompt({
      type: 'confirm',
      name: 'confirm',
      message: `This will OVERWRITE the REMOTE using your local folders`
    });
    if(!answer || !answer.confirm){
      return false;
    }

  } else {
    // remote-to-local 

    answer = await prompt({
      type: 'confirm',
      name: 'confirm',
      message: `This will fetch from remote and OVERWRITE your LOCAL folders in this directory (./app.second.xyz/, etc)`
    });
    if(!answer || !answer.confirm){
      return false;
    }

  }


  console.log('Creating watchers');

  // create watchers
  for(let inputNodePath of nodePaths){
    startSyncForPath({
      inputNodePath,
      host,
      direction
    });

  }


}

async function startSyncForPath(opts){

  let {
    inputNodePath,
    host,
    direction
  } = opts;

  let cwd = process.cwd() + '/' + inputNodePath + '/';
  let remotePath = host + ':' + path.join(DEFAULT_REMOTE_PATH, inputNodePath) + '/';

  let src, dest;
  if(direction == 'local-to-remote'){
    src = cwd;
    dest = remotePath;

    // ensure local directory exists 
    await fs.ensureDir(cwd);
  } else {
    // remote-to-local 
    src = remotePath;
    dest = cwd;
  }

  // console.log('Source:', src);
  // console.log('Destination:', dest);

  // Build the command
  var rsync = new Rsync()
    // .shell('ssh -p 2222')
    .shell('ssh -p 2222 -o "StrictHostKeyChecking=no"')
    .flags('v')
    .recursive()
    .compress()
    .progress()
    .delete()
    .exclude(['node_modules','.DS_Store'])
    .source(src)
    .destination(dest);


  function runSync(){
    return new Promise((resolve)=>{
      // Execute the command
      rsync.execute(function(error, code, cmd) {
        console.log('Synced ', inputNodePath ,' Error:', error, 'ExitCode:', code); //, cmd);
        resolve();
      });
    });
  }

  if(direction == 'local-to-remote'){
    // Start watching for changes to files 
    console.log('Watching for file changes');
    const spinner = ora().start()
    // spinner.stop()

    let toRun = true;

    chokidar.watch('.', {
      ignoreInitial: true,
      ignored: ['node_modules', 'node_modules/**/*'],
      cwd: cwd
    }).on('all', (event, path) => {
      // console.log(event, path);
      // runSync();
      toRun = true;
    });

    // // Run once initially (now handled by toRun) 
    // runSync();

    // check for further runs 
    function checkToRun(){
      if(toRun){
        toRun = false;
        runSync()
        .then(()=>{
          setTimeout(checkToRun, 1000);
        });
      } else {
        setTimeout(checkToRun,1000);
      }
    }
    checkToRun();

  }

  if(direction == 'remote-to-local'){
    runSync();
  }

}
