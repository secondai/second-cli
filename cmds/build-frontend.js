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
const lodash = require('lodash');

var Handlebars = require('handlebars');
var helpers = require('handlebars-helpers')({
  handlebars: Handlebars
});



module.exports = async (args) => {

  let buildRootInputPath = args._[1];
  if(!buildRootInputPath){
    error('Please include a path after build-frontend (second-cli build-frontend .)');
    process.exit(1);
  }
  let buildRootPath = path.resolve(buildRootInputPath);

  let buildOutline = args['skip-outline'] ? false:args['auto-outline']; // undefined (ask), true, false 
  let installMissing = args['skip-missing'] ? false:args['auto-add-missing']; // undefined (ask), true, false 
  let upgradeSecondComponents = args['skip-upgrades'] ? false:args['auto-upgrade']; // undefined (ask), true, false 
  let buildSource = args['skip-build-source'] ? false:args['auto-build-source']; // undefined (ask), true, false 
  // console.log('installMissing:', installMissing);
  // process.exit(1);
  if(args.y){
    // yes to all build steps (unless specifically skipped) 
    buildOutline = buildOutline === false ? buildOutline : true;
    installMissing = installMissing === false ? installMissing : true;
    upgradeSecondComponents = upgradeSecondComponents === false ? upgradeSecondComponents : true;
    buildSource = buildSource === false ? buildSource : true;
  } else if(args.skip){
    buildOutline = buildOutline === true ? buildOutline : false;
    installMissing = installMissing === true ? installMissing : false;
    upgradeSecondComponents = upgradeSecondComponents === true ? upgradeSecondComponents : false;
    buildSource = buildSource === true ? buildSource : false;
  }

  let pkgPath = path.join(buildRootPath,'package.json');
  let manifestPath = path.join(buildRootPath,'public/manifest.json'); // for changing the start_url to package.json's "homepage" 
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


  if(buildOutline !== false){
    let answerBuildOutline;
    let runBuildOutline;
    if(buildOutline === undefined){
      answerBuildOutline = await prompt({
        type: 'confirm',
        name: 'confirm',
        message: `Build source from outline.json?`
      });
      if(answerBuildOutline && answerBuildOutline.confirm){
        runBuildOutline = true;
      }
    } else {
      runBuildOutline = true;
    }

    // install 
    if(runBuildOutline){

      let outline;
      try {
        outline = require(path.join(buildRootPath, '/outline.json'));
      }catch(err){
        console.error('Invalid outline.json');
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
          console.log('Local:', path.join(localComponentRelativeToDir, componentName));
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
      console.log('Emptied directory');
      let firstFile = processOutlineLevel(outline.components);
      fs.writeFileSync(path.join(outputDir, '0_index.js'), `module.exports = require('./${firstFile}').default;`,'utf8');
      // console.log('firstFile:', firstFile);
      console.log('Finished src update from outline');
    }
  }

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
        let command1 = `cd ${buildRootPath} && yarn add ${missingPackages.join(' ')}`;
        console.log('Command1:', command1);
        var child = spawn(command1, {shell: true, stdio: 'inherit', stderr: 'inherit'});
        // child.stdout.on('data', (data) => {
        //   console.log(`CHILD stdout: ${data}`);
        // });
        // child.stderr.on('data', (data) => {
        //   console.error(`CHILD stderr: ${data}`);
        // });
        var resolveExit;
        var onExit = new Promise(r=>{resolveExit=r});
        child.on('exit', function (code, signal) {
          console.log(`second-cli command process exited with ` +
                      `code ${code} and signal ${signal}`);
          if(code != 0){ 
            return process.exit(1);
          }
          resolveExit();
        });
        await onExit;
      }
    } else {
      console.log('Skipping installing missing packages');
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
        console.log(`second-cli command process exited with ` +
                    `code ${code} and signal ${signal}`);
        if(code != 0){ 
          return process.exit(1);
        }
        resolveExit();
      });
      await onExit;
    }
  }


  // npm run second:build
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

      // update manifest's start_url 
      let manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      let pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      manifestJson.start_url = pkgJson.homepage;
      fs.writeFileSync(manifestPath, JSON.stringify(manifestJson,null,2));

      let command3 = `cd ${buildRootPath} && npm run second:build`;
      console.log('Command3:', command3);
      var child = spawn(command3, {shell: true, stdio: 'inherit', stderr: 'inherit'});
      var resolveExit;
      var onExit = new Promise(r=>{resolveExit=r});
      child.on('exit', function (code, signal) {
        console.log(`second-cli command process exited with ` +
                    `code ${code} and signal ${signal}`);
        if(code != 0){ 
          return process.exit(1);
        }
        resolveExit();
      });
      await onExit;
    }
  }

}
