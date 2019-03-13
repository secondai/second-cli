const menus = {
  main: `
    second-cli [command] <options>

    sync .............. local to remote 
    dl ........... remote to local
    version ............ show package version
    help ............... show help menu for a command`,

  sync, dl: `
    second-cli sync|dl node.path.here <options>

    --host ..... i.e.: root@ipaddress`,

}

module.exports = (args) => {
  const subCmd = args._[0] === 'help'
    ? args._[1]
    : args._[0]

  console.log(menus[subCmd] || menus.main)
}
