
pdf-personalize
===============

**Personalize PDF with Overlay and Encryption**

<p/>
<img src="https://nodei.co/npm/pdf-personalize.png?downloads=true&stars=true" alt=""/>

<p/>
<img src="https://david-dm.org/rse/pdf-personalize.png" alt=""/>

Abstract
--------

This is a small utility for personalizing a PDF document by adding a
prominent personal overlay information to each page and/or by encrypting
the PDF with a personal password. This way the chance of being spread
widely can be reduced for a medium-sensible document.

Installation
------------

`$ npm install -g pdf-personalize`

(NOTICE: this requires Java to be installed for the internal Apache PDFBox dependency)

Usage
-----

```
$ pdf-personalize \
  [-p <receiver-name>] \
  [-B <overlay-background-color>] \
  [-F <overlay-foreground-color>] \
  [-O <overlay-opacity>] \
  [-e <receiver-password>] \
  [-o <output-pdf-file>] \
  <pdf-file>
```

Example
--------

```
$ pdf-personalize -p "Mr. John Doe" -e "secret" -o test-personalized.pdf test.pdf
```

![screenshot](test-screenshot.png)

License
-------

Copyright &copy; 2019-2022 Dr. Ralf S. Engelschall (http://engelschall.com/)

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

