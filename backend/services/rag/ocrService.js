const { createWorker } = require("tesseract.js");

let workerPromise = null;
let ocrQueue = Promise.resolve();

/**
 * Creates one reusable Tesseract worker.
 */
const getOcrWorker = async () => {
  if (!workerPromise) {
    console.log("Starting OCR worker...");

    workerPromise = createWorker("eng");
  }

  return workerPromise;
};

/**
 * Performs OCR on an image buffer.
 *
 * @param {Buffer|Uint8Array} imageBuffer
 * @param {object} options
 * @param {number|null} options.pageNumber
 * @returns {Promise<string>}
 */
const ocrImageBuffer = async (imageBuffer, { pageNumber = null } = {}) => {
  const runOcr = async () => {
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error("A valid image buffer is required for OCR.");
    }

    if (pageNumber) {
      console.log(`Running OCR on page ${pageNumber}...`);
    } else {
      console.log("Running OCR...");
    }

    const worker = await getOcrWorker();

    const result = await worker.recognize(imageBuffer);

    const text = result?.data?.text?.trim() || "";

    if (pageNumber) {
      console.log(`OCR completed for page ${pageNumber}. Extracted ${text.length} characters.`);
    }

    return text;
  };

  /*
   * Use one OCR worker sequentially.
   */
  const currentJob = ocrQueue.then(runOcr, runOcr);

  /*
   * Keep queue functional even when
   * one OCR attempt fails.
   */
  ocrQueue = currentJob.catch(() => undefined);

  return currentJob;
};

/**
 * Stops the reusable Tesseract worker.
 */
const terminateOcrWorker = async () => {
  if (!workerPromise) {
    return;
  }

  try {
    const worker = await workerPromise;

    await worker.terminate();

    console.log("OCR worker stopped.");
  } finally {
    workerPromise = null;
    ocrQueue = Promise.resolve();
  }
};

module.exports = {
  ocrImageBuffer,
  terminateOcrWorker,
};
