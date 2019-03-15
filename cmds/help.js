const menus = {
  main: `
    second-cli [command] <options>

    push ............... local to remote (overwriting) 
    pull ............... remote to local (overwriting) 
    version ............ show package version
    help ............... show help menu for a command`,

  push, pull: `
    second-cli push|pull <options>

    --node, -n ........... i.e.: app.second.sample_app,
    --host ............... i.e.: root@ipaddress`,

}

module.exports = (args) => {
  const subCmd = args._[0] === 'help'
    ? args._[1]
    : args._[0]

  console.log(menus[subCmd] || menus.main)
}
