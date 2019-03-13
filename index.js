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

    case 'sync':
      require('./cmds/sync')('local-to-remote', args)
      break

    case 'download':
    case 'dl':
      require('./cmds/sync')('remote-to-local', args)
      break

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