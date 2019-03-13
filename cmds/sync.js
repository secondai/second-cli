const ora = require('ora')
const Rsync = require('rsync');
const path = require('path');
const chokidar = require('chokidar');
const { prompt } = require('enquirer');

module.exports = async (direction, args) => {

  let inputNodePath = args._[1];
  if(inputNodePath.split('/').length > 1){
    console.error('Do not include a slash in your app node path');
    return;
  }

  if(!args.host){
    console.error('Missing --host like root@ipaddress');
    return;
  }

  let cwd = process.cwd() + '/';
  let remotePath = args.host + ':' + path.join('/usr/src/attached-volume/', inputNodePath) + '/';

  let answer, src, dest;
  if(direction == 'local-to-remote'){
    src = cwd;
    dest = remotePath;

    answer = await prompt({
      type: 'confirm',
      name: 'confirm',
      message: 'This will copy from LOCAL to REMOTE, overwriting the remote directory'
    });
    if(!answer || !answer.confirm){
      return false;
    }

  } else {
    src = remotePath;
    dest = cwd;

    answer = await prompt({
      type: 'confirm',
      name: 'confirm',
      message: 'This will copy from REMOTE to LOCAL, overwriting your local directories contents'
    });
    if(!answer || !answer.confirm){
      return false;
    }

  }

  // console.log('Source:', src);
  // console.log('Destination:', dest);

  // Build the command
  var rsync = new Rsync()
    // .shell('ssh -p 2222')
    .shell('ssh -p 2222')
    .flags('v')
    .recursive()
    .compress()
    .progress()
    .delete()
    .exclude(['node_modules','.DS_Store'])
    .source(src)
    .destination(dest);


  // Start watching for changes to files 

  // One-liner for current directory, ignores .dotfiles
  if(direction == 'local-to-remote'){
    console.log('Watching for file changes');
    const spinner = ora().start()
    // spinner.stop()
    chokidar.watch('.', {
      ignoreInitial: true,
      ignored: ['node_modules'],
      cwd: process.cwd()
    }).on('all', (event, path) => {
      console.log(event, path);
      runSync();
    });
  }


  function runSync(){
    return new Promise((resolve)=>{
      // Execute the command
      rsync.execute(function(error, code, cmd) {
          // we're done
          // console.log("RSYNC DONE!\n", error, "\n---\n", code, "\n---\n", cmd);
          console.log('synced');
          resolve();
      });
    });
  }

}
