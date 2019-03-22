const depcheck = require('depcheck');
const dependencyCheck = require('dependency-check');

const ora = require('ora')
const Rsync = require('rsync');
const path = require('path');
const chokidar = require('chokidar');
const { prompt } = require('enquirer');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const error = require('../utils/error');



var Handlebars = require('handlebars');
var helpers = require('handlebars-helpers')({
  handlebars: Handlebars
});
const lodash = require('lodash');



module.exports = async (args) => {

  let buildRootInputPath = args._[1];
  if(!buildRootInputPath){
    error('Please include a path after build-frontend (second-cli build-frontend .)');
    process.exit(1);
  }
  let buildRootPath = path.resolve(buildRootInputPath);

  let installMissing = args['skip-missing'] ? false:args['auto-add-missing']; // undefined (ask), true, false 
  let upgradeSecondComponents = args['skip-upgrades'] ? false:args['auto-upgrade']; // undefined (ask), true, false 
  let buildSource = args['skip-build-source'] ? false:args['auto-build-source']; // undefined (ask), true, false 
  // console.log('installMissing:', installMissing);
  // process.exit(1);
  if(args.y){
    // yes to all build steps (unless specifically skipped) 
    installMissing = installMissing === false ? installMissing : true;
    upgradeSecondComponents = upgradeSecondComponents === false ? upgradeSecondComponents : true;
    buildSource = buildSource === false ? buildSource : true;
  }

  let pkgPath = path.join(buildRootPath,'package.json');
  let srcIndexPath = path.join(buildRootPath, 'src/index.js');
  let outputDir = path.join(buildRootPath, 'src/outline-output');
  let localComponentRelativeToDir = path.join(buildRootPath); //, 'src/components'); Using relative to outline.json 

  console.log('localComponentRelativeToDir:', localComponentRelativeToDir);
  // {
  //  "name" : "second-component-react-default-layout",
  //  "vars" : {
  //    "childComponent":{
  //      "name" : "./left-right",
  //      "vars" : {
  //        "leftComponent":{
  //          "name" : "./basic-text",
  //          "vars" : {
  //            "text": "this is the left"
  //          }
  //        },
  //        "rightComponent":{
  //          "name" : "./basic-text",
  //          "vars" : {
  //            "text": "this is the right"
  //          }
  //        }
  //      }
  //    },
  //    "title":"this is the title"
  //  }
  // }

  let outline;
  try {
    outline = require(path.join(buildRootPath, '/outline.json'));
  }catch(err){
    console.error('Invalid outlinejson');
    process.exit(1);
  }

  var loaderTemplate = Handlebars.compile(`
  let React = require('react');
  let {{capitalize (camelcase level.name)}}Component = require('{{{componentPath}}}').default;

  let propsObj = {
    {{#each props}}
      {{{@key}}} : {{{this}}},
    {{/each}}
  }

  class {{capitalize (camelcase level.name)}}ComponentImport extends React.Component {
    constructor(props){
      super(props)
      this.state = {}
    }
    render(){
      return (
        <{{capitalize (camelcase level.name)}}Component
          {...this.props}
          {...propsObj}
        />
      )
    }
  }

  export default {{capitalize (camelcase level.name)}}ComponentImport;
  `);


  let id = 1;
  function processOutlineLevel(level){
    let thisId = id;
    id++;
    let props = {}
    let componentName = level.name;
    let componentInfo;
    let componentPath;
    if(componentName.substring(0,1) == '.'){
      // local
      console.log('LOCAL:', path.join(localComponentRelativeToDir, componentName));
      componentInfo = JSON.parse(fs.readFileSync(path.join(localComponentRelativeToDir, componentName, '/second.json'),'utf8'));
      // set internal path for including components 
      componentPath = path.relative(outputDir, path.join(componentName, componentInfo.component));
      // console.log('PATH:', path.join(localComponentRelativeToDir, componentName, componentInfo.component));
    } else {
      // // npm 
      // componentInfo = require(componentName + '/second.json');
      componentPath = componentName;
    }

    // console.log('COMPONENT:', component);
    for(let key in level.vars){
      let val = level.vars[key];
      if(lodash.endsWith(key,'Component')){
        var componentCreatedPath = processOutlineLevel(val);
        props[key] = `require('./${componentCreatedPath}').default`; // local, was created for importing others! 
      } else if(lodash.endsWith(key,'Components')){
        // processOutlineLevel(val);
        let arrObj = [];
        for(let obj of val){
          var componentCreatedPath = processOutlineLevel(obj);
          arrObj.push(`require('./${componentCreatedPath}').default`);
        }
        props[key] = "[\n       " + arrObj.join(",\n        ") + "\n    ]";

      } else {
        props[key] = JSON.stringify(val); // TODO: jsonify for template (without losing types) 
      }
    }
    let output = loaderTemplate({
      componentPath,
      level,
      props
    });
    let componentNewName = thisId.toString() + '_' + level.name.replace(/[^a-zA-Z]+/g, '');
    fs.writeFileSync(path.join(outputDir, componentNewName + '.js'), output, 'utf8');
    console.log(":-------",componentNewName,"-----:");
    return componentNewName;
  }
  fs.emptyDirSync(outputDir);
  console.log('Emptyied directory');
  let firstFile = processOutlineLevel(outline);
  fs.writeFileSync(path.join(outputDir, '0_index.js'), `module.exports = require('./${firstFile}').default;`,'utf8');
  // console.log('firstFile:', firstFile);

  // Find missing "second-xyz" packages 
  // Run 'yarn add' for stuff? 
  const depOptions = {
    // withoutDev: false, // [DEPRECATED] check against devDependencies
    ignoreBinPackage: true, // ignore the packages with bin entry
    // skipMissing: false, // skip calculation of missing dependencies
    ignoreDirs: [ // folder with these names will be ignored
      'build',
      'node_modules',
      'public',
      // 'components'
    ],
    // ignoreMatches: [ // ignore dependencies that matches these globs
    //   'grunt-*'
    // ],
    // parsers: { // the target parsers
    //   '*.js': depcheck.parser.es6,
    //   '*.jsx': depcheck.parser.jsx
    // },
    // detectors: [ // the target detectors
    //   depcheck.detector.requireCallExpression,
    //   depcheck.detector.importDeclaration
    // ],
    // specials: [ // the target special parsers
    //   depcheck.special.eslint,
    //   depcheck.special.webpack
    // ],
  };
  let pkgResult = await depcheck(buildRootPath, depOptions);
  // let pkgResult = await dependencyCheck({
  //   missing: true,
  //   extra: true,
  //   path: pkgPath,
  //   noDefaultEntries: true,
  //   entries: srcIndexPath,
  //   detective: 'detective-es6'
  // });
  // console.log('pkgResult:', pkgResult);
  // process.exit(1);
  // console.log('Using:', Object.keys(pkgResult.using));
  // console.log('Missing:', pkgResult.missing);
  let missing = pkgResult.missing;
  delete missing.components;
  let allPackages = Object.keys(pkgResult.using).filter(k=>{
    return k.indexOf('second-') != -1;
  });
  let missingPackages = Object.keys(missing).filter(k=>{
    return k.indexOf('second-') != -1;
  });
  console.log('Used Packages:', allPackages.length, allPackages);
  console.log('Missing Second Packages:', missingPackages.length, missingPackages);

  // Missing Packages
  if(missingPackages.length){
    if(installMissing !== false){
      let answerYarnAdd;
      let runMissing;
      if(installMissing === undefined){
        answerYarnAdd = await prompt({
          type: 'confirm',
          name: 'confirm',
          message: `Install missing second packages?: ${missingPackages.join(' ')}`
        });
        if(answerYarnAdd && answerYarnAdd.confirm){
          runMissing = true;
        }
      } else {
        runMissing = true;
      }

      // install 
      if(runMissing){
        let command = `cd ${buildRootPath} && yarn add ${missingPackages.join(' ')}`;
        console.log('Command:', command);
        var child = spawn(command, {shell: true, stdio: 'inherit', stderr: 'inherit'});
        // child.stdout.on('data', (data) => {
        //   console.log(`CHILD stdout: ${data}`);
        // });
        // child.stderr.on('data', (data) => {
        //   console.error(`CHILD stderr: ${data}`);
        // });
        var resolveExit;
        var onExit = new Promise(r=>{resolveExit=r});
        child.on('exit', function (code, signal) {
          console.log(`CHILD process exited with ` +
                      `code ${code} and signal ${signal}`);
          resolveExit();
        });
        await onExit;
      }
    }
    
  }

  // yarn upgrade components 
  if(upgradeSecondComponents !== false){
    let answerUpgrade;
    let runUpgrade;
    if(upgradeSecondComponents === undefined){
      answerUpgrade = await prompt({
        type: 'confirm',
        name: 'confirm',
        message: `Upgrade second components?: ${allPackages.join(' ')}`
      });
      if(answerUpgrade && answerUpgrade.confirm){
        runUpgrade = true;
      }
    } else {
      runUpgrade = true;
    }

    // upgrade 
    // - TODO: use `npm check` for necessary/possible updates to second packages 
    if(runUpgrade){
      let command2 = `cd ${buildRootPath} && yarn upgrade ${allPackages.join(' ')}`;
      console.log('Command2:', command2);
      var child = spawn(command2, {shell: true, stdio: 'inherit', stderr: 'inherit'});
      var resolveExit;
      var onExit = new Promise(r=>{resolveExit=r});
      child.on('exit', function (code, signal) {
        console.log(`CHILD process exited with ` +
                    `code ${code} and signal ${signal}`);
        resolveExit();
      });
      await onExit;
    }
  }


  // yarn upgrade components 
  if(buildSource !== false){
    let answerBuildSource;
    let runBuildSource;
    if(buildSource === undefined){
      answerBuildSource = await prompt({
        type: 'confirm',
        name: 'confirm',
        message: `Build source?:`
      });
      if(answerBuildSource && answerBuildSource.confirm){
        runBuildSource = true;
      }
    } else {
      runBuildSource = true;
    }

    // upgrade 
    // - TODO: use `npm check` for necessary/possible updates to second packages 
    if(runBuildSource){
      let command3 = `cd ${buildRootPath} && npm run second:build:self`;
      console.log('Command3:', command3);
      var child = spawn(command3, {shell: true, stdio: 'inherit', stderr: 'inherit'});
      var resolveExit;
      var onExit = new Promise(r=>{resolveExit=r});
      child.on('exit', function (code, signal) {
        console.log(`CHILD process exited with ` +
                    `code ${code} and signal ${signal}`);
        resolveExit();
      });
      await onExit;
    }
  }

}
