const fs = require("fs/promises");

const { PDFParse } = require("pdf-parse-v2");

const { cleanPdfText, isReadablePdfText, isReadableOcrText } = require("./textCleanerService");

const { ocrImageBuffer, terminateOcrWorker } = require("./ocrService");

/**
 * Reads a PDF and returns one document object
 * per readable page.
 *
 * Processing strategy:
 *
 * 1. Extract text normally.
 * 2. Check whether the text is readable.
 * 3. If not readable, render that page as PNG.
 * 4. Run OCR on the PNG.
 * 5. Clean and validate the OCR result.
 *
 * @param {string} filePath
 * @param {object} resourceMetadata
 * @returns {Promise<Array<object>>}
 */
const readPdfByPage = async (filePath, resourceMetadata = {}) => {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("A valid PDF file path is required.");
  }

  let parser = null;
  let ocrWasUsed = false;

  try {
    /*
     * =========================================
     * STEP 1:
     * Read PDF file.
     * =========================================
     */

    const pdfBuffer = await fs.readFile(filePath);

    /*
     * Use the modern pdf-parse API.
     */
    parser = new PDFParse({
      data: pdfBuffer,
    });

    /*
     * =========================================
     * STEP 2:
     * Extract text from every page.
     * =========================================
     */

    const textResult = await parser.getText({
      pageJoiner: "",

      /*
       * Modern pdf-parse joins text items with
       * an empty string by default. That can
       * produce words such as:
       *
       * "thebest"
       * "roleof"
       * "peopleto"
       *
       * Joining text items with a space prevents
       * adjacent PDF text spans from being merged.
       */
      itemJoiner: " ",

      /*
       * Preserve logical line separation.
       */
      lineEnforce: true,
    });

    const totalPages = textResult.total;

    if (!totalPages || totalPages < 1) {
      throw new Error("The PDF does not contain any pages.");
    }

    const pageDocuments = [];

    /*
     * =========================================
     * STEP 3:
     * Process pages individually.
     * =========================================
     */

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      /*
       * pdf-parse v2 represents individual
       * pages as:
       *
       * {
       *     num: 1,
       *     text: "..."
       * }
       */
      const pageResult = textResult.pages.find((page) => page.num === pageNumber);

      const rawPageText = (pageResult?.text || "").trim();

      let cleanedPageText = rawPageText ? cleanPdfText(rawPageText) : "";

      let finalPageText = cleanedPageText;

      let extractionMethod = "native";

      let ocrRawText = "";

      /*
       * Determine whether the normal PDF
       * text layer is usable.
       */
      const nativeTextIsReadable = Boolean(cleanedPageText) && isReadablePdfText(cleanedPageText);

      /*
       * =========================================
       * STEP 4:
       * OCR fallback.
       * =========================================
       */

      if (!nativeTextIsReadable) {
        if (!rawPageText) {
          console.warn(`Page ${pageNumber}: no native text was extracted. Trying OCR...`);
        } else if (!cleanedPageText) {
          console.warn(
            `Page ${pageNumber}: no readable text remained after cleaning. Trying OCR...`
          );
        } else {
          console.warn(
            `Page ${pageNumber}: native text appears corrupted or unreadable. Trying OCR...`
          );
        }

        try {
          ocrWasUsed = true;

          /*
           * Render ONLY the problematic
           * page to PNG.
           *
           * The modern pdf-parse package
           * handles the Node-compatible
           * PDF rendering internally.
           */
          const screenshotResult = await parser.getScreenshot({
            partial: [pageNumber],

            /*
             * 2x resolution gives
             * Tesseract clearer text.
             */
            scale: 2,

            /*
             * We only need the
             * binary image.
             */
            imageDataUrl: false,

            imageBuffer: true,
          });

          const screenshotPage = screenshotResult?.pages?.[0];

          const imageBuffer = screenshotPage?.data;

          if (!imageBuffer || imageBuffer.length === 0) {
            throw new Error("PDF page could not be rendered as an image.");
          }

          /*
           * Perform OCR on PNG image.
           */
          ocrRawText = await ocrImageBuffer(imageBuffer, {
            pageNumber,
          });

          const cleanedOcrText = ocrRawText ? cleanPdfText(ocrRawText) : "";

          /*
           * Validate OCR output before
           * accepting it into RAG.
           */
          if (cleanedOcrText && isReadableOcrText(cleanedOcrText)) {
            finalPageText = cleanedOcrText;

            extractionMethod = "ocr";

            console.log(`Page ${pageNumber}: OCR text accepted.`);
          } else {
            console.warn(
              `Skipping page ${pageNumber}: OCR did not produce sufficiently readable text.`
            );

            continue;
          }
        } catch (ocrError) {
          console.warn(`Skipping page ${pageNumber}: OCR failed: ${ocrError.message}`);

          continue;
        }
      }

      /*
       * =========================================
       * STEP 5:
       * Final safety check.
       * =========================================
       */

      if (!finalPageText || !isReadablePdfText(finalPageText)) {
        console.warn(`Skipping page ${pageNumber}: no usable text could be obtained.`);

        continue;
      }

      /*
       * =========================================
       * STEP 6:
       * Add page to RAG document list.
       * =========================================
       */

      pageDocuments.push({
        pageContent: finalPageText,

        metadata: {
          ...resourceMetadata,

          source: resourceMetadata.source || filePath,

          sourcePath: filePath,

          pageNumber,

          totalPages,

          /*
           * Either:
           *
           * native
           * ocr
           */
          extractionMethod,

          nativeRawCharacterCount: rawPageText.length,

          ocrRawCharacterCount: ocrRawText.length,

          rawCharacterCount: extractionMethod === "ocr" ? ocrRawText.length : rawPageText.length,

          cleanedCharacterCount: finalPageText.length,
        },
      });
    }

    /*
     * =========================================
     * STEP 7:
     * Validate final result.
     * =========================================
     */

    if (pageDocuments.length === 0) {
      throw new Error(
        "No readable text could be extracted using either native PDF extraction or OCR."
      );
    }

    const nativePages = pageDocuments.filter(
      (document) => document.metadata.extractionMethod === "native"
    ).length;

    const ocrPages = pageDocuments.filter(
      (document) => document.metadata.extractionMethod === "ocr"
    ).length;

    const skippedPages = totalPages - pageDocuments.length;

    console.log("\n========================================");

    console.log("PDF EXTRACTION COMPLETED");

    console.log("========================================");

    console.log(`Total pages: ${totalPages}`);

    console.log(`Accepted pages: ${pageDocuments.length}`);

    console.log(`Native extraction: ${nativePages}`);

    console.log(`OCR extraction: ${ocrPages}`);

    console.log(`Skipped pages: ${skippedPages}`);

    console.log("========================================\n");

    return pageDocuments;
  } catch (error) {
    throw new Error(`Unable to read PDF: ${error.message}`);
  } finally {
    /*
     * Always release the PDF parser.
     */
    if (parser) {
      try {
        await parser.destroy();
      } catch (error) {
        console.warn(`Unable to close PDF parser cleanly: ${error.message}`);
      }
    }

    /*
     * Stop Tesseract only if OCR
     * actually ran.
     */
    if (ocrWasUsed) {
      try {
        await terminateOcrWorker();
      } catch (error) {
        console.warn(`Unable to stop OCR worker cleanly: ${error.message}`);
      }
    }
  }
};

module.exports = {
  readPdfByPage,
};
