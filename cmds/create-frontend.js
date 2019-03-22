const ora = require('ora')
const Rsync = require('rsync');
const path = require('path');
const chokidar = require('chokidar');
const { prompt } = require('enquirer');
const fs = require('fs-extra');
const exec = require('child_process').exec;
const error = require('../utils/error');
const lodash = require('lodash');

module.exports = async (args) => {

  // ask for "pretty" name of component (ie Left Right Columns) 
  let name = lodash.kebabCase(inputName);

  // prefix with "second-component-" then kebab-case 


}
