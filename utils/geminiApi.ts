import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, ChatSession, Content } from "@google/generative-ai";

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
const MODEL_NAME = "gemini-1.5-flash-latest";

let genAI: GoogleGenerativeAI | null = null;
let model: ChatSession | null = null;

if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
  // Initialize the chat session here, or as needed. 
  // For simplicity, we'll re-initialize chat in the function if needed, or maintain one session.
  // Let's create a new chat session for each fresh interaction for now (when history is empty)
} else {
  console.warn("EXPO_PUBLIC_GOOGLE_API_KEY is missing. Help tool will not function properly.");
}

// Gemini API expects history in this format
// type ChatMessage = { role: "user" | "model"; parts: { text: string }[]; };
// This is equivalent to Content[] from the SDK if parts is an array, but parts is an object in Content.
// The SDK's Content type is: export declare type Content = { parts: Part[]; role: string; };
// And Part is: export declare type Part = (TextPart | InlineDataPart | FunctionCallPart | FunctionResponsePart);
// So, { text: string } is a TextPart.

/**
 * Sends a message to the Gemini API and returns the response.
 * @param userMessage The message from the user.
 * @param history The conversation history, conforming to the SDK's Content[] type.
 * @param recipeContext Optional recipe context to prepend for the first message.
 * @returns The bot's response text or null if an error occurs.
 */
export async function sendMessageToGemini(
  userMessage: string,
  history: Content[], // Use Content[] type from SDK
  recipeContext?: {
    instructions: string[];
    substitutions?: string | null;
  }
): Promise<string | null> {
  if (!genAI) {
    console.error("Gemini AI SDK is not initialized (API key might be missing).");
    return "Error: Help feature is not available (API key missing or SDK init failed).";
  }

  let promptForApi = userMessage;
  let historyForApi: Content[] = [...history]; // history is empty on first call from HelpTool normally

  // Define safetySettings here so it's in scope for the model initialization
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ];

  if (history.length === 0 && recipeContext) {
    console.log("Constructing initial history with recipe context.");
    let contextText = "You are a friendly and helpful recipe assistant. \n";
    contextText += "The user is currently working on the following recipe:\n\n";
    contextText += "Instructions:\n";
    recipeContext.instructions.forEach((step, index) => {
      contextText += `${index + 1}. ${step}\n`;
    });
    if (recipeContext.substitutions) {
      contextText += `\nNotes on substitutions: ${recipeContext.substitutions}\n`;
    }
    contextText += "\n--- END OF RECIPE CONTEXT ---\n\n";
    contextText += "Now, please answer the user's question about this recipe. Be concise and helpful.\n";
    
    // New approach: Add context as the first "user" message in history, then the actual user question follows.
    // Or, more robustly, provide it as a system message if the model/SDK supports distinct system roles.
    // For now, let's make the context part of the initial history. The model should understand the structure.
    historyForApi = [
      { role: "user", parts: [{ text: contextText }] }, 
      // The actual first user message will be sent via chat.sendMessage(userMessage)
      // Or, if the model expects the first *actual* user message after context in history:
      // { role: "user", parts: [{ text: userMessage }] }
      // Let's try with context as a user turn, then the actual userMessage as the prompt to sendMessage.
    ];
    promptForApi = userMessage; // The prompt to sendMessage is just the user's current utterance.
    // If the above doesn't work, an alternative is one big initial user message:
    // promptForApi = `${contextText}\nUser question: ${userMessage}`;
    // historyForApi = []; // And history is empty
  }

  // console.log("[geminiApi] History for API:", JSON.stringify(historyForApi, null, 2));
  console.log("[geminiApi] Prompt for API (sendMessage):", promptForApi);

  try {
    // Initialize the model and start chat here
    const generativeModel = genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings });
    const chat = generativeModel.startChat({
        history: historyForApi,
        generationConfig: {
            // maxOutputTokens: 200, 
        },
    });

    const result = await chat.sendMessage(promptForApi);
    const response = result.response;
    const text = response.text();
    
    // console.log("Gemini Response:", text);
    return text;

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Check for specific error types if needed, e.g., blocked prompts
    if (error instanceof Error && error.message.includes("SAFETY")) {
        return "Sorry, your request was blocked due to safety settings. Please rephrase your question.";
    }
    return "Sorry, I encountered an error trying to get a response. Please try again later.";
  }
} 