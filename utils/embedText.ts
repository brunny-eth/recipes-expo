const backendUrl = process.env.EXPO_PUBLIC_API_URL!;

export const embedText = async (text: string): Promise<number[]> => {
  if (!backendUrl) {
    console.error("[embedText] EXPO_PUBLIC_API_URL is not set.");
    throw new Error("API URL is not configured. Cannot embed text.");
  }

  if (!text) {
    throw new Error("Input text cannot be empty.");
  }
  
  try {
    const response = await fetch(`${backendUrl}/api/ai/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }
    return data.embedding;
  } catch (error) {
    console.error("[embedText] Error calling backend embed endpoint:", error);
    // Re-throw the error so the calling function (e.g., parseTextRecipe) can handle it.
    throw error;
  }
};