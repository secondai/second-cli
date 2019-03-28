const menus = {
  main: `
    second-cli [command] <options>

    build-frontend .........builds source from outline, installs dependencies, etc.
    create-frontend ........creates a sample frontend app (like create-react-app, then configures some variables) 
    create-component .......just run 'nwb' 

    sync ............... local to remote (using Unison) 
    push ............... local to remote (overwriting) 
    pull ............... remote to local (overwriting) 
    version ............ show package version
    help ............... show help menu for a command`,

  'build-frontend': `
    second-cli build-frontend <path> <options>

    -y ..................... enter "y" for each input request (add missing, upgrade, build from source) 
    --skip .................. skip all build requests (unless specified) 

    --skip-outline ........... skips building source from outline 
    --auto-outline ..........doesnt ask before building outline 

    --skip-missing ........... skips missing components 
    --auto-add-missing ..........autoinstalls via 'yarn add second-component-xyz'

    --skip-upgrades ........... skip upgrades for second components 
    --auto-upgrade ..........yarn upgrade for all second components 'yarn upgrade second-component-xyz second-component-xyz2'
    
    --skip-build-source ........... skips building from source
    --auto-build-source ..........runs 'npm run second:build:self' afterwards'`,

  'create-frontend': `
    second-cli create-frontend <options>`,


  sync: `
    second-cli sync <options>

    --node, -n ........... i.e.: "all" or "app.second.sample_app",
    --host ............... i.e.: root@ipaddress`,

  'push, pull': `
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
