# Demo code
```javascript

var converter = require('htmls-to-epub');

converter.convert({
  inputDir: '/path/of/input/dir',
  outputDir: '/path/of/output/dir'
}).then( ()=> {
  console.log('OK');
});
```


# Content of the input directory
* The config file named `htmls-to-epub.json`.
* The files listed in the `files` property of the config file.

# Config file format
```json
{
  "title": "The title of the book",
  "creator": "The creator of the book",
  "language": "zh-Hant",
  "files": [
    {
      "filename": "cover.jpg",
      "id": "cover",
      "mediaType": "image/jpeg"
    },
    {
      "filename": "style.css",
      "id": "stylesheet",
      "mediaType": "text/css"
    },
    {
      "filename": "chapter01.html",
      "id": "chapter01",
      "mediaType": "application/xhtml+xml",
      "order": 1,
      "navLabel": "Chapter 1",
      "navLevel": 0
    },
    {
      "filename": "chapter02.html",
      "id": "chapter02",
      "mediaType": "application/xhtml+xml",
      "order": 1,
      "navLabel": "Chapter 2",
      "navLevel": 0
    },
    {
      "filename": "chapter03.html",
      "id": "chapter03",
      "mediaType": "application/xhtml+xml",
      "order": 1,
      "navLabel": "Chapter 3",
      "navLevel": 0
    }
  ]
}
```
