#!/usr/opkg/bin/node
/*!
**  pdf-personalize -- Personalize PDF with Overlays and Encryption
**  Copyright (c) 2019-2020 Dr. Ralf S. Engelschall <rse@engelschall.com>
**
**  Permission is hereby granted, free of charge, to any person obtaining
**  a copy of this software and associated documentation files (the
**  "Software"), to deal in the Software without restriction, including
**  without limitation the rights to use, copy, modify, merge, publish,
**  distribute, sublicense, and/or sell copies of the Software, and to
**  permit persons to whom the Software is furnished to do so, subject to
**  the following conditions:
**
**  The above copyright notice and this permission notice shall be included
**  in all copies or substantial portions of the Software.
**
**  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
**  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
**  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
**  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
**  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
**  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
**  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*  internal requirements  */
const fs            = require("fs").promises

/*  external requirements  */
const yargs         = require("yargs")
const chalk         = require("chalk")
const tmp           = require("tmp")
const Prince        = require("prince")
const PDFBox        = require("pdfbox-simple")
const PDF2JSON      = require("pdf2json")
const SRP           = require("secure-random-password")

/*  act in an asynchronous context  */
;(async () => {
    /*  command-line option parsing  */
    const argv = yargs
        /* eslint indent: off */
        .usage("Usage: $0 [-h] [-v] [-o <pptx-file>] <psd-file>")
        .help("h").alias("h", "help").default("h", false)
            .describe("h", "show usage help")
        .string("o").nargs("o", 1).alias("o", "output").default("o", "")
            .describe("o", "output PDF file")
        .string("p").nargs("p", 1).alias("p", "personalize").default("p", "")
            .describe("p", "personalize by adding an Overlay to each page referencing the name of the receiver")
        .string("e").nargs("e", 1).alias("e", "encrypt").default("e", "")
            .describe("e", "encrypt the output PDF with a password of the receiver")
        .version(false)
        .strict()
        .showHelpOnFail(true)
        .demand(1)
        .parse(process.argv.slice(2))

    /*  take input PDF  */
    const stage0 = tmp.fileSync()
    await fs.copyFile(argv._[0], stage0.name)

    /*  initialize PDFBox  */
    const pdfbox = new PDFBox()

    /*  optionally personalize PDF with Overlay  */
    const stage1 = tmp.fileSync()
    if (argv.personalize) {
        /*  determine width and height of PDF  */
        const pdf2json = new PDF2JSON()
        pdf2json.loadPDF(stage0.name)
        const { w, h } = await new Promise((resolve, reject) => {
            pdf2json.on("pdfParser_dataReady", (pdf) => {
                const w = pdf.formImage.Width / 4.5
                const h = pdf.formImage.Pages[0].Height / 4.5
                resolve({ w, h })
            })
            pdf2json.on("pdfParser_dataError", (error) => {
                reject(error)
            })
        })

        /*  generate overlay page  */
        const overlayHTML = tmp.fileSync()
        const html = `
            <html>
                <head>
                    <style type="text/css">
                        @page {
                            size:         ${w}in ${h}in;
                            margin:       0;
                        }
                        body, html {
                            margin:       0;
                            width:        ${w}in;
                            height:       ${h}in;
                            position:     relative;
                        }
                        .overlay .circle {
                            position:     absolute;
                            right:        -2cm;
                            bottom:       -5cm;
                            width:        8cm;
                            height:       8cm;
                            opacity:      0.8;
                        }
                        .overlay .circle circle {
                            fill:         #ff3300;
                        }
                        .overlay .text {
                            position:     absolute;
                            right:        0.5cm;
                            bottom:       0.5cm;
                            color:        #ffffff;
                            font-family:  "Helvetica Neue", Helvetica, sans-serif;
                            font-size:    9pt;
                            text-align:   right;
                        }
                    </style>
                </head>
                <body>
                    <div class="overlay">
                        <svg class="circle" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                             <circle cx="50" cy="50" r="50"/>
                        </svg>
                        <div class="text">
                            This copy is licensed to<br/>
                            <b>${argv.personalize}</b><br>
                            for strict personal use only.<br/>
                            Any redistribution is prohibited.
                        </div>
                    </div>
                </body>
            </html>
        `
        await fs.writeFile(overlayHTML.name, html, { encoding: "utf8" })
        const overlayPDF = tmp.fileSync()
        await Prince()
            .inputs(overlayHTML.name)
            .output(overlayPDF.name)
            .execute()

        /*  merge overlay page onto all pages of the document  */
        await pdfbox.exec(
            "OverlayPDF",
            stage0.name,
            "-position", "foreground",
            "-useAllPages", overlayPDF.name,
            stage1.name
        )

        /*  cleanup  */
        overlayHTML.removeCallback()
        overlayPDF.removeCallback()
    }
    else
        await fs.copyFile(stage0.name, stage1.name)

    /*  optionally protect PDF with encryption  */
    const stage2 = tmp.fileSync()
    if (argv.encrypt) {
        const randomPW = SRP.randomPassword({
            length: 80,
            characters: [ SRP.lower, SRP.upper, SRP.digits, SRP.symbols ]
        })
        await pdfbox.exec(
            "Encrypt",
            "-canAssemble", "false",
            "-canExtractContent", "false",
            "-canExtractForAccessibility", "false",
            "-canFillInForm", "false",
            "-canModify", "false",
            "-canModifyAnnotations", "false",
            "-canPrint", "false",
            "-canPrintDegraded", "false",
            "-keyLength", "256",
            "-O", randomPW,
            "-U", argv.encrypt,
            stage1.name,
            stage2.name
        )
    }
    else
        await fs.copyFile(stage1.name, stage2.name)

    /*  provide output PDF  */
    await fs.copyFile(stage2.name, argv.output)

    /*  cleanup (remove all temporary files)  */
    stage1.removeCallback()
    stage2.removeCallback()
})().catch((err) => {
    /*  report error  */
    process.stderr.write(chalk.red(`pdf-personalize: ERROR: ${err.stack}\n`))
    process.exit(1)
})

