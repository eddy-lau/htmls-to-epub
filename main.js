/* jshint esversion: 6, node: true */
'use strict';
var fs = require('fs-extra');
var path = require('path');
var archiver = require('archiver');
var parseString = require('xml2js').parseString;
var moment = require('moment');
var xml2js = require('xml2js');
var uuidv1 = require('uuid/v1');
var arrayToTree = require('array-to-tree');


function parseXML(data) {

  return new Promise( (resolve, reject ) => {
    parseString(data, (err, result) => {
      if (err) {
        reject(err);
      }else {
        resolve(result);
      }
    });
  });

}

function buildMetadata(metadataPath, config, uuid) {

  return fs.readFile(metadataPath).then( data=> {

      return parseXML(data);

  }).then( json => {

    var title = config.title || 'My Great Book';
    var creator = config.creator || 'Me';
    var language = config.language || 'en';

    json.package.metadata[0]['dc:title'][0] = title;
    json.package.metadata[0]['dc:creator'][0]._ = creator;
    json.package.metadata[0]['dc:creator'][0].$['opf:file-as'] = creator;
    json.package.metadata[0]['dc:date'][0] = moment().toISOString();
    json.package.metadata[0]['dc:language'][0] = language;
    json.package.metadata[0]['dc:identifier'][0]._ = uuid;
    json.package.metadata[0].meta[0].$.content = '{&quot;' + creator + '&quot;: &quot;&quot;}';

    var builder = new xml2js.Builder();
    var xml = builder.buildObject(json);
    return fs.writeFile(metadataPath, xml);

  });

}

function buildManifest(metadataPath, htmlFiles) {

  return fs.readFile(metadataPath).then( data=> {

      return parseXML(data);

  }).then( json => {

    var builder = new xml2js.Builder();

    json.package.manifest[0].item =
      htmlFiles.map( htmlFile => {

        var attr = {
          href: htmlFile.filename,
          id: htmlFile.id,
          'media-type': htmlFile.mediaType
        };

        if (htmlFile.properties != undefined) {
          attr.properties = htmlFile.properties;
        }

        return {
          $: attr
        };

      });

    json.package.spine[0].itemref = htmlFiles.filter( htmlFile => {

      return htmlFile.order !== undefined;

    }).map( htmlFile => {
      return {
        $: {
          idref: htmlFile.id
        }
      };
    });

    var xml = builder.buildObject(json);
    return fs.writeFile(metadataPath, xml);

  });
}

function convertToTree(htmlFiles) {

  return arrayToTree(

    htmlFiles.filter( htmlFile => {

      return htmlFile.navLevel !== undefined &&
             htmlFile.navLabel !== undefined &&
             htmlFile.order !== undefined &&
             htmlFile.filename !== undefined &&
             htmlFile.id !== undefined;

    }).sort( (lhs, rhs) => {

      if (lhs.order < rhs.order) {
        return -1;
      } else if (lhs.order > rhs.order) {
        return 1;
      } else {
        return 0;
      }

    }).reduce( (accumulator, htmlFile) => {

      accumulator.array.push(htmlFile);

      if (htmlFile.navLevel == 0) {
        htmlFile.parent_id = undefined;
        accumulator.navLevelMap[0] = htmlFile;
      } else {
        htmlFile.parent_id = accumulator.navLevelMap[htmlFile.navLevel-1].id;
        accumulator.navLevelMap[htmlFile.navLevel] = htmlFile;
      }

      return accumulator;

    }, {
      navLevelMap: {},
      array: []
    }).array

  );

}

function buildTOC(tocPath, htmlFiles, uuid) {

  function htmlFileToElement(htmlFile) {

    var element = {};
    element = {
      $: {
        id: 'num_' + htmlFile.order,
        playOrder: '' + htmlFile.order
      },
      navLabel: {
        text: htmlFile.navLabel
      },
      content: {
        '$': {
          src: htmlFile.filename
        }
      }
    };

    if (htmlFile.children && htmlFile.children.length> 0) {
      element.navPoint = htmlFile.children.map(htmlFileToElement);
    }

    return element;

  }

  return fs.readFile(tocPath).then( data=> {

      return parseXML(data);

  }).then( json => {

    var builder = new xml2js.Builder();

    json.ncx.head[0].meta[0].$.content = uuid;
    json.ncx.navMap[0].navPoint = convertToTree(htmlFiles).map(htmlFileToElement);

    builder.options.xmldec.standalone = undefined;
    builder.options.xmldec.encoding = 'utf-8';

    var xml = builder.buildObject(json);
    return fs.writeFile(tocPath, xml);

  }).then( () => {

    return {
      book: {
        id: 'toc',
      },
      filename: path.basename(tocPath),
      id: 'ncx',
      mediaType: 'application/x-dtbncx+xml'
    };

  });

}


function convert(opts) {

  var inputDir = opts.inputDir;
  if (!inputDir) {
    throw new Error('Missing inputDir');
  }

  var outputDir = opts.outputDir;
  if (!outputDir) {
    throw new Error('Missing outputDir');
  }

  var templateDir = path.join(outputDir,'template');
  var metadataPath = path.join(templateDir, 'metadata.opf');
  var tocPath = path.join(templateDir, 'toc.ncx');
  var uuid = uuidv1();
  var config;
  var files;

  return fs.readFile(path.join(inputDir, 'htmls-to-epub.json'))
  .then( data => {

    config = JSON.parse(data);
    files = config.files;
    return fs.remove(templateDir);

  }).then( ()=> {

    return fs.ensureDir(outputDir);

  }).then( () => {

    return fs.copy(
      path.join(__dirname,'template'),
      templateDir
    );

  }).then( () => {

    return Promise.all(
      files.map( file => {

        return fs.copy(
          path.join(inputDir, file.filename),
          path.join(templateDir, file.filename)
        );

      })
    );

  }).then( () => {

    return buildTOC(tocPath, files, uuid);

  }).then( toc => {

    files.push(toc);
    return buildMetadata(metadataPath, config, uuid);

  }).then( ()=> {

    return buildManifest(metadataPath, files);

  }).then( ()=> {

    return new Promise( (resolve, reject) => {

      var fileName = opts.outputFileName || 'output.epub';
      var outputFilePath = path.join(outputDir, fileName);
      var fileOutput = fs.createWriteStream(outputFilePath);

      fileOutput.on('close', function () {
        console.log('ePub generated. ' + archive.pointer() + ' total bytes');
        resolve();
      });

      var archive = archiver('zip');
      archive.pipe(fileOutput);
      archive.directory(templateDir, false);

      archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
          console.log(err);
        } else {
          reject(err);
        }
      });

      archive.on('error', function(err){
        reject(err);
      });
      archive.finalize();

    });

  }).then( ()=> {

    return fs.remove(templateDir);

  });

}

module.exports = {
  convert: convert
};
