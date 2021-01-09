#!/usr/opkg/bin/node
/*!
**  pdf-personalize -- Personalize PDF with Overlays and Encryption
**  Copyright (c) 2019-2021 Dr. Ralf S. Engelschall <rse@engelschall.com>
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
const fsR           = require("fs")
const fs            = require("fs").promises

/*  external requirements  */
const yargs         = require("yargs")
const chalk         = require("chalk")
const tmp           = require("tmp")
const PDFKit        = require("pdfkit")
const PDFBox        = require("pdfbox-simple")
const PDF2JSON      = require("pdf2json")
const SRP           = require("secure-random-password")

/*  act in an asynchronous context  */
;(async () => {
    /*  command-line option parsing  */
    const argv = yargs
        /* eslint indent: off */
        .usage(
            "Usage: $0 [-h] " +
            "[-p <receiver-name>] " +
            "[-B <overlay-background-color>] " +
            "[-F <overlay-foreground-color>] " +
            "[-O <overlay-opacity>] " +
            "[-e <receiver-password>] " +
            "[-o <output-pdf-file>] " +
            "<pdf-file>")
        .help("h").alias("h", "help").default("h", false)
            .describe("h", "show usage help")
        .string("p").nargs("p", 1).alias("p", "personalize").default("p", "")
            .describe("p", "personalize by adding an Overlay to each page referencing the name of the receiver")
        .string("B").nargs("B", 1).alias("B", "overlay-background-color").default("B", "#ff3300")
            .describe("B", "background color of the overlay (the cicle)")
        .string("F").nargs("F", 1).alias("F", "overlay-foreground-color").default("F", "#ffffff")
            .describe("F", "foreground color of the overlay (the text)")
        .number("O").nargs("O", 1).alias("O", "overlay-opacity").default("O", 0.8)
            .describe("O", "opacity of the overlay (the circle)")
        .string("e").nargs("e", 1).alias("e", "encrypt").default("e", "")
            .describe("e", "encrypt the output PDF with a password of the receiver")
        .string("o").nargs("o", 1).alias("o", "output").default("o", "")
            .describe("o", "output PDF file")
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
        const cm2pt = (cm) => (cm / 2.54 * 72)
        const doc = new PDFKit({ size: [ w * 72, h * 72 ] })
        doc.circle(doc.page.width - cm2pt(2), doc.page.height + cm2pt(1), cm2pt(4))
            .lineWidth(0)
            .fillOpacity(argv.overlayOpacity)
            .fill(argv.overlayBackgroundColor)
        doc.fontSize(9)
            .font("Helvetica")
            .fill(argv.overlayForegroundColor)
        const lh = doc.heightOfString("Xg")
        doc.text("This copy is licensed to",
            doc.page.width  - cm2pt(6.5),
            doc.page.height - cm2pt(0.5) - (4 * lh),
            { width: cm2pt(6), height: 9, align: "right" })
        doc.font("Helvetica-Bold")
            .text(argv.personalize,
            { width: cm2pt(6), height: 9, align: "right" })
        doc.font("Helvetica")
            .text("for strict personal use only.",
            { width: cm2pt(6), height: 9, align: "right" })
            .text("Any redistribution is prohibited.",
            { width: cm2pt(6), height: 9, align: "right" })
        const savePdfToFile = (doc, fileName) => {
            return new Promise((resolve, reject) => {
                let pendingStepCount = 2
                const stepFinished = () => {
                    if (--pendingStepCount === 0)
                        resolve()
                }
                const writeStream = fsR.createWriteStream(fileName, { encoding: null })
                writeStream.on("close", stepFinished)
                doc.pipe(writeStream)
                doc.end()
                stepFinished()
            })
        }
        const overlayPDF = tmp.fileSync()
        await savePdfToFile(doc, overlayPDF.name)

        /*  merge overlay page onto all pages of the document  */
        await pdfbox.exec(
            "OverlayPDF",
            stage0.name,
            "-position", "foreground",
            "-useAllPages", overlayPDF.name,
            stage1.name)

        /*  cleanup  */
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
            stage2.name)
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

