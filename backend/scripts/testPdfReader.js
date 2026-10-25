const path = require("path");

const { readPdfByPage } = require("../services/rag/pdfReaderService");

/**
 * Usage:
 *
 * node tests/testPdfReader.js ./path/to/file.pdf
 */

const runTest = async () => {
  try {
    const fileArgument = process.argv[2];

    if (!fileArgument) {
      console.error("\nPlease provide a PDF file path.");

      console.log("\nExample:");

      console.log("node tests/testPdfReader.js ./test-files/sample.pdf\n");

      process.exit(1);
    }

    const filePath = path.resolve(fileArgument);

    console.log("\n========================================");

    console.log("PDF + OCR TEST");

    console.log("========================================");

    console.log(`File: ${filePath}\n`);

    const documents = await readPdfByPage(filePath, {
      source: path.basename(filePath),

      testMode: true,
    });

    console.log("\n========================================");

    console.log("PAGE RESULTS");

    console.log("========================================\n");

    documents.forEach((document) => {
      const {
        pageNumber,
        extractionMethod,
        nativeRawCharacterCount,
        ocrRawCharacterCount,
        cleanedCharacterCount,
      } = document.metadata;

      console.log(`PAGE ${pageNumber}`);

      console.log(`Method: ${extractionMethod}`);

      console.log(`Native characters: ${nativeRawCharacterCount}`);

      console.log(`OCR characters: ${ocrRawCharacterCount}`);

      console.log(`Final characters: ${cleanedCharacterCount}`);

      /*
       * Show only the beginning so the
       * terminal does not become flooded
       * with the whole document.
       */
      const preview = document.pageContent.replace(/\s+/g, " ").trim().slice(0, 500);

      console.log("\nText preview:");

      console.log(preview);

      console.log("\n----------------------------------------\n");
    });

    /*
     * -----------------------------------------
     * PAGE COUNTS
     * -----------------------------------------
     */

    const nativePages = documents.filter(
      (document) => document.metadata.extractionMethod === "native"
    );

    const ocrPages = documents.filter((document) => document.metadata.extractionMethod === "ocr");

    /*
     * -----------------------------------------
     * DETECT SKIPPED PAGES
     * -----------------------------------------
     *
     * readPdfByPage() stores totalPages in
     * every accepted document's metadata.
     *
     * We compare all possible page numbers
     * against the page numbers that were
     * actually returned.
     */

    const totalPages = documents[0]?.metadata?.totalPages || 0;

    const acceptedPageNumbers = new Set(documents.map((document) => document.metadata.pageNumber));

    const skippedPageNumbers = [];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      if (!acceptedPageNumbers.has(pageNumber)) {
        skippedPageNumbers.push(pageNumber);
      }
    }

    /*
     * -----------------------------------------
     * TEST SUMMARY
     * -----------------------------------------
     */

    console.log("========================================");

    console.log("TEST SUMMARY");

    console.log("========================================");

    console.log(`Total PDF pages: ${totalPages}`);

    console.log(`Accepted pages: ${documents.length}`);

    console.log(`Native pages: ${nativePages.length}`);

    console.log(`OCR pages: ${ocrPages.length}`);

    console.log(`Skipped pages: ${skippedPageNumbers.length}`);

    console.log(
      `Skipped page numbers: ${
        skippedPageNumbers.length > 0 ? skippedPageNumbers.join(", ") : "None"
      }`
    );

    console.log("========================================\n");

    /*
     * -----------------------------------------
     * OCR RESULT
     * -----------------------------------------
     */

    if (ocrPages.length > 0) {
      console.log("✅ OCR fallback was triggered successfully.");

      console.log(`✅ ${ocrPages.length} page(s) were recovered using OCR.\n`);
    } else {
      console.log("ℹ️ No OCR was needed for this PDF.\n");
    }

    /*
     * -----------------------------------------
     * SKIPPED PAGE RESULT
     * -----------------------------------------
     */

    if (skippedPageNumbers.length > 0) {
      console.log(
        `⚠️ ${skippedPageNumbers.length} page(s) were rejected because neither native extraction nor OCR produced acceptable text.`
      );

      console.log(`Pages: ${skippedPageNumbers.join(", ")}\n`);
    } else {
      console.log("✅ No pages were skipped.\n");
    }
  } catch (error) {
    console.error("\n❌ PDF/OCR TEST FAILED");

    console.error(error.message);

    console.error(error.stack);

    process.exit(1);
  }
};

runTest();
