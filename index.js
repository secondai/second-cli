const minimist = require('minimist')
const error = require('./utils/error')

// second sync
// second dl 

module.exports = () => {

  const args = minimist(process.argv.slice(2))

  let cmd = args._[0] || 'help'

  if (args.version || args.v) {
    cmd = 'version'
  }

  if (args.help || args.h) {
    cmd = 'help'
  }

  switch (cmd) {

    case 'build-frontend':
      require('./cmds/build-frontend')(args)
      break

    case 'create-frontend':
      require('./cmds/build-frontend')(args)
      break

    case 'push':
      require('./cmds/pushpull')('local-to-remote', args)
      break

    case 'download':
    case 'dl':
    case 'pull':
      require('./cmds/pushpull')('remote-to-local', args)
      break

    case 'sync':
      require('./cmds/sync')(args)
      break;

    case 'version':
      require('./cmds/version')(args)
      break

    case 'help':
      require('./cmds/help')(args)
      break

    default:
      error(`"${cmd}" is not a valid command!`, true)
      break
  }
}
