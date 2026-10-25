const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";

/**
 * Sends a prompt to Ollama and returns Gemma's response.
 *
 * @param {string} prompt - The prompt that will be sent to Gemma.
 * @param {Object} options - Optional generation settings.
 * @returns {Promise<string>} - The generated response from Gemma.
 */
const generateResponse = async (prompt, options = {}) => {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("A valid prompt is required.");
  }

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt.trim(),
        stream: false,
        ...(options.json ? { format: "json" } : {}),

        options: {
          temperature: options.temperature ?? 0.2,
          num_predict: options.numPredict ?? 800,
          num_ctx: options.numCtx ?? 8192,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(`Ollama request failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (!data.response) {
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
