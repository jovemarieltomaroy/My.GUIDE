const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";

/**
 * Sends a prompt to Ollama and returns the model response.
 *
 * @param {string} prompt - Prompt sent to Ollama.
 * @param {Object} options - Optional generation settings.
 * @param {number} options.temperature
 * @param {number} options.numPredict
 * @param {boolean} options.json
 *
 * @returns {Promise<string>}
 */
const generateResponse = async (prompt, options = {}) => {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("A valid prompt is required.");
  }

  try {
    /*
     * ---------------------------------------------
     * BUILD REQUEST BODY
     * ---------------------------------------------
     */

    const requestBody = {
      model: OLLAMA_MODEL,

      prompt: prompt.trim(),

      stream: false,

      options: {
        temperature: options.temperature ?? 0.2,

        num_predict: options.numPredict ?? 800,
      },
    };

    /*
     * ---------------------------------------------
     * OPTIONAL JSON MODE
     * ---------------------------------------------
     *
     * Ollama can constrain generation to JSON.
     *
     * We only enable this when the caller explicitly
     * requests JSON so this service can still be used
     * for normal text generation elsewhere.
     */

    if (options.json === true) {
      requestBody.format = "json";
    }

    /*
     * ---------------------------------------------
     * SEND REQUEST
     * ---------------------------------------------
     */

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(requestBody),
    });

    /*
     * ---------------------------------------------
     * HANDLE HTTP ERROR
     * ---------------------------------------------
     */

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(`Ollama request failed with status ${response.status}: ${errorText}`);
    }

    /*
     * ---------------------------------------------
     * READ RESPONSE
     * ---------------------------------------------
     */

    const data = await response.json();

    if (!data.response || typeof data.response !== "string" || !data.response.trim()) {
      throw new Error("Ollama returned an empty response.");
    }

    return data.response.trim();
  } catch (error) {
    console.error("Ollama Service Error:", error.message);

    throw new Error(`Failed to generate response using ${OLLAMA_MODEL}: ${error.message}`);
  }
};

/**
 * Checks whether Ollama is currently running.
 *
 * @returns {Promise<boolean>}
 */
const checkOllamaConnection = async () => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);

    return response.ok;
  } catch (error) {
    return false;
  }
};

module.exports = {
  generateResponse,
  checkOllamaConnection,
};
