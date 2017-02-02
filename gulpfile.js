var gulp = require('gulp');
var shell = require('gulp-shell');
var fs = require('fs');
var path = require('path');
var del = require('del');
var glob = require('glob');
var ReactDocGen = require('react-docgen');
var generateMarkdown = require('./build_helpers/react_documentation/generateMarkdown');
var Constants = require('./site/Constants');

gulp.task('dev-server', ['del-site-folders', 'build-api-docs', 'webpack-prerender', 'build-site-index-pages', 'webpack-dev-server'])

gulp.task('del-site-folders', function() {
    del(['__site__', '__site_prerender__']).then(() => {
        return;
    });
})

gulp.task('webpack-prerender', shell.task([
  'webpack --config "' + __dirname + '/site/webpack-prerender.config.js"'
]))


gulp.task('webpack-dev-server', shell.task([
  'webpack-dev-server --config "' + __dirname + '/site/webpack-client.config.js" --no-info --content-base __site__'
]))

gulp.task('build-site-index-pages', ['webpack-prerender'],  function() {
    var renderPath = require('./__site_prerender__/renderPath');

    var sitePath = path.join(__dirname, '/__site__');
    if (!fs.existsSync(sitePath)) {
      fs.mkdirSync(sitePath);
    }

    var files = {
      'main.css': 'main.css',
      'main.js': 'main.js'
    };

    if (process.env.NODE_ENV === 'production') {
      Object.keys(files).forEach(function(fileName) {
        var searchPath = path.join(
          __dirname,
          '/__site__/'  + fileName.replace('.', '-*.')
        );
        var hashedFilename = glob.sync(searchPath)[0];
        if (!hashedFilename) {
          throw new Error(
            'Hashed file of "' + fileName + '" ' +
            'not found when searching with "' + searchPath + '"'
          );
        }

        files[fileName] = path.basename(hashedFilename);
      });
    }

    function getAllLocations(pages) {
      var locations = [];
      for (var key in pages) {
        if (!pages.hasOwnProperty(key) || typeof pages[key] !== 'object') {
          continue;
        }

        if (pages[key].groupTitle) {
          locations = [].concat(locations, getAllLocations(pages[key]));
        }

        if (pages[key].location) {
          locations.push(pages[key].location);
        }
      }

      return locations;
    }

    var locations = Constants.ALL_PAGES.reduce(function(allPages, pages) {
      return [].concat(allPages, getAllLocations(pages));
    }, []);

    locations.forEach(function(fileName) {
      var props = {
        location: fileName,
        devMode: process.env.NODE_ENV !== 'production',
        files: files
      };

      renderPath(fileName, props, function(content) {
        fs.writeFileSync(
          path.join(sitePath, fileName),
          content
        );
      });
    });
})

gulp.task('build-api-docs', function() {
    var docsPath = path.join(__dirname, '/docs/api');
    if (!fs.existsSync(docsPath)) {
      fs.mkdirSync(docsPath);
    }

    var PROJECT_ROOT = __dirname;
    var FILES_TO_READ = [
      {
        path: path.join(PROJECT_ROOT, 'src/FixedDataTableNew.react.js'),
        name: 'Table',
        markdownFileName: 'TableAPI.md'
      },
      {
        path: path.join(PROJECT_ROOT, 'src/FixedDataTableColumnNew.react.js'),
        name: 'Column',
        markdownFileName: 'ColumnAPI.md'
      },
      {
        path: path.join(PROJECT_ROOT, 'src/FixedDataTableColumnGroupNew.react.js'),
        name: 'ColumnGroup',
        markdownFileName: 'ColumnGroupAPI.md'
      },
      {
        path: path.join(PROJECT_ROOT, 'src/FixedDataTableCellDefault.react.js'),
        name: 'Cell',
        markdownFileName: 'CellAPI.md'
      }
    ];

    FILES_TO_READ.forEach(function(file) {
      var fileSource = fs.readFileSync(file.path);
      var fileDocsData = ReactDocGen.parse(fileSource);
      var markdownFilePath = path.join(docsPath, file.markdownFileName);

      var headerComment = '<!-- File generated from "' +
        file.path.replace(PROJECT_ROOT, '') +
        '" -->\n';

      fs.writeFileSync(
        markdownFilePath,
        headerComment + generateMarkdown(file.name, fileDocsData)
      );

      console.log('Wrote: ' + markdownFilePath);
    });
})