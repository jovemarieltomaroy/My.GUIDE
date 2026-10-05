const testGemma = async () => {
  try {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemma3:4b",
        messages: [
          {
            role: "user",
            content: `
                    You are an advisory assistant for a professional guidance counselor.

                    A college student reports:
                    - feeling overwhelmed by academic requirements
                    - difficulty sleeping before examinations
                    - fear of disappointing their family

                    Suggest three possible counseling intervention approaches.

                    For each approach provide:
                    1. Intervention name
                    2. Rationale
                    3. Possible counselor-guided activities

                    Do not make a diagnosis.
                    Do not present the recommendation as a replacement for professional judgment.
                    `,
          },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    console.log("\nGemma response:\n");
    console.log(data);
  } catch (error) {
    console.error("Error communicating with Gemma:");
    console.error(error.message);
  }
};

testGemma();