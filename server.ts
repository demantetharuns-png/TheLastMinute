import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import { createRequire } from "module";

// Safely require the CommonJS pdf-parse module within an ESM environment
const require = createRequire(import.meta.url);
const pdfParser = require("pdf-parse");

dotenv.config();

const app = express();
const PORT = 3000;

// Set payload limit high to support larger PDFs
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy initializer for Google GenAI client
let aiClient: GoogleGenAI | null = null;
let lastSuccessfulModel = "gemini-3.5-flash";

function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("[Gemini API Warn] GEMINI_API_KEY environment variable is not defined.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Lazy initializer for OpenAI client
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  if (!openaiClient) {
    const key = process.env.OPENAI_API_KEY;
    if (key) {
      console.log("[OpenAI API Initialization] Created OpenAI client instance");
      openaiClient = new OpenAI({ apiKey: key });
    }
  }
  return openaiClient;
}

// HELPER: Bulletproof JSON Parser for OpenAI outputs
function cleanAndParseJSON(rawText: string): any {
  try {
    // Remove markdown code blocks if OpenAI sneaks them in
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      // Using new RegExp to prevent esbuild parser errors with backticks
      cleaned = cleaned
        .replace(new RegExp("\\n?```$"), "")
        .trim();
    }
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("[JSON Parse Error] Failed to parse AI output. Raw output was:", rawText);
    throw new Error("The AI returned malformed JSON data. Please try again.");
  }
}

// Helper to parse uploaded PDF or txt file content cleanly into text on the server
async function extractTextFromDoc(doc: { type: string; content?: string; base64?: string }): Promise<string> {
  if (!doc) return "";
  if (doc.type === "pdf" && doc.base64) {
    try {
      console.log("[PDF Parser] Parsing base64 PDF using pdf-parse...");
      const buffer = Buffer.from(doc.base64, "base64");
      const parsed = await pdfParser(buffer);
      console.log(`[PDF Parser] Successfully extracted ${parsed.text ? parsed.text.length : 0} characters.`);
      return parsed.text || "";
    } catch (err: any) {
      console.error("[PDF Parser Error] Failed to parse PDF with pdf-parse library:", err);
      return doc.content || "";
    }
  }
  return doc.content || "";
}

// Helper to reliably extract plain text from Gemini content objects for OpenAI fallback
function extractPlainTexts(contents: any): string {
  if (!contents) return "";
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) {
    return contents
      .map((item) => {
        if (!item) return "";
        if (typeof item === "string") return item;
        if (item.text) return item.text;
        if (item.inlineData) {
          return `[PDF Material Attached: mimeType=${item.inlineData.mimeType}]`;
        }
        return JSON.stringify(item);
      })
      .join("\n");
  }
  if (typeof contents === "object") {
    if (contents.text) return contents.text;
    if (contents.inlineData) {
      return `[PDF Material Attached: mimeType=${contents.inlineData.mimeType}]`;
    }
    return JSON.stringify(contents);
  }
  return String(contents);
}

// Reusable function to execute generateContent with automatic retry and model fallback
async function generateContentWithRetry(
  ai: GoogleGenAI | null,
  params: {
    contents: any;
    config?: any;
  }
): Promise<any> {
  const openai = getOpenAIClient();
  
  // If OpenAI is available, prioritize it completely as requested!
  if (openai) {
    try {
      console.log("[OpenAI API Primary] Utilizing gpt-4o-mini directly for fast, high-demand execution...");
      const plainTextPrompt = extractPlainTexts(params.contents);
      
      const systemPrompt = `You are an elite academic assistant and subject-matter expert study tutor.
Always read the provided reference documents, syllabus guidelines, and course materials.
Then, create a clean, fully accurate, and formatted JSON response that exactly matches the requested structure and schema.

CRITICAL INSTRUCTIONS & SCHEMA GUIDELINES:
1. Return ONLY the raw parseable JSON object.
2. DO NOT wrap JSON inside markdown blocks like \`\`\`json ... \`\`\`.
3. Adhere strictly to the requested keys.
4. Satisfaction of words:
   - For any "5-mark" answer key, the generated text must be descriptive and contain at least 80-100 words.
   - For any "10-mark" answer key, the generated text must contain a thorough introduction, detailed body explanation, examples, and conclusion, reaching at least 180-200 words.
5. Grounding: Limit your content strictly to the factual syllabus and subject modules provided. Avoid fluff. If specific details are missing, frame it gracefully as general academic guidance.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: plainTextPrompt + "\n\nRequired Schema Rules:\n" + JSON.stringify(params.config?.responseSchema || {}) }
        ],
        response_format: { type: "json_object" },
      });

      const responseText = completion.choices[0]?.message?.content || "{}";
      console.log("[OpenAI API Primary] Success! Structured JSON generated successfully.");
      
      return {
        text: responseText
      };
    } catch (openaiErr: any) {
      console.error("[OpenAI API Primary Error] OpenAI call failed:", openaiErr?.message || openaiErr);
      // Improved error handling for when Gemini isn't configured
      if (!ai) {
        throw new Error(`OpenAI encountered an error: ${openaiErr?.message || openaiErr}`);
      }
      console.log("[OpenAI API Primary] Falling back to Gemini pipeline...");
    }
  }

  // Fallback to Gemini if OpenAI is unavailable OR if it fails but we have Gemini configured
  if (!ai) {
    throw new Error("No AI providers are configured or available. Please check your API keys and quotas.");
  }

  const modelsPool = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  
  // Pivot models list so the last successful model is attempted first
  const modelsToTry = [
    lastSuccessfulModel,
    ...modelsPool.filter((m) => m !== lastSuccessfulModel),
  ];

  const maxRetries = 2; // Fast failover to fallbacks
  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Gemini API] Calling generateContent with model: ${model} (attempt ${attempt}/${maxRetries})...`);
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        
        // Cache successful model
        if (lastSuccessfulModel !== model) {
          console.log(`[Gemini API] Switching active model cache to: ${model}`);
          lastSuccessfulModel = model;
        }
        return response;
      } catch (error: any) {
        lastError = error;
        console.warn(`[Gemini API Warning] Attempt ${attempt} for model ${model} failed:`, error?.message || error);
        
        // Exponential backoff
        if (attempt < maxRetries) {
          const delay = attempt * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    console.warn(`[Gemini API Warning] All ${maxRetries} attempts failed for model: ${model}. Trying fallback model if available.`);
  }

  throw lastError || new Error("Failed to generate content after retries and fallback models.");
}

// 1. EXTRACT QUESTIONS ENDPOINT
app.post("/api/extract-questions", async (req: Request, res: Response): Promise<void> => {
  try {
    const { questionBank } = req.body;

    if (!questionBank || (!questionBank.content && !questionBank.base64)) {
      res.status(400).json({ error: "No question bank content provided." });
      return;
    }

    const ai = getGeminiClient();
    const documentText = await extractTextFromDoc(questionBank);

    const promptText = `Analyze this Question Bank / Important Questions document. 
Identify all specific, distinct questions or exam-style questions listed inside.
Extract each question with its original text. Give each a clear, short category (like a unit, topic name, or section, e.g., 'Unit 1: Basics', 'Module B', or 'General').
Return a clean structured JSON array of questions, ensuring there are no duplicates.`;

    const response = await generateContentWithRetry(ai, {
      contents: [
        { text: `Document content:\n${documentText}` },
        { text: promptText }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "A simple unique ID, like q1, q2, q3..." },
                  text: { type: Type.STRING, description: "The full text of the question or prompt." },
                  category: { type: Type.STRING, description: "A course category, chapter, or module indicating where this fits." },
                },
                required: ["id", "text", "category"],
              },
            },
          },
          required: ["questions"],
        },
      },
    });

    const text = response.text || "{}";
    // Using the new bulletproof parser
    const result = cleanAndParseJSON(text);
    res.json(result);
  } catch (error: any) {
    console.error("Error in extract-questions:", error);
    res.status(500).json({ error: error?.message || "Failed to extract questions from document." });
  }
});

// 2. GENERATE ANSWERS ENDPOINT (process single question with high quality & strict length metrics)
app.post("/api/generate-answers", async (req: Request, res: Response): Promise<void> => {
  try {
    const { subjectModule, question, type } = req.body;

    if (!question) {
      res.status(400).json({ error: "Missing question string." });
      return;
    }
    if (!subjectModule || (!subjectModule.content && !subjectModule.base64)) {
      res.status(400).json({ error: "No subject module content provided or uploaded." });
      return;
    }

    const ai = getGeminiClient();
    const materialText = await extractTextFromDoc(subjectModule);

    const generate5 = type === "5mark" || type === "both";
    const generate10 = type === "10mark" || type === "both";

    const promptText = `You are an expert tutor creating study materials. 
Your objective is to generate exam-ready answers for the student's question based strictly on the provided "Subject Module" material.

Question to answer: "${question}"

Provide answers for the following based on requests:
${generate5 ? `- A "5-mark" Answer: Must be structured with bullet points of core definitions/key formulas/main steps. Minimum word count must be 80-100 words. (Do not make it shorter than 80 words!).` : ""}
${generate10 ? `- A "10-mark" Answer: Must be structured with a full academic layout: "Introduction", "Detailed Core Explanation", "Key Concepts" (with bullet points), "Illustrative Example or Application", and "Summary/Conclusion". Minimum word count must be 180-200 words. (Do not make it shorter than 180 words!).` : ""}

CRITICAL RULES:
1. Grounding: Rely primarily on factual concepts and headings explicitly mentioned in the Subject Module document. If a topic is not discussed in the document, start your response with a clear header saying: "[General Academic Guide - Topic not detailed in syllabus]" and then answer it accurately.
2. Rigid Word Counts:
   - If generating the 5-mark answer, its text MUST be at least 80 words. If it is short, write more explanatory details or sub-points.
   - If generating the 10-mark answer, its text MUST be at least 180 words. If it is short, expand on the detailed Core Explanation or supply a longer illustrative example.
3. Be sure you actually count the words and confirm you have satisfied the word counts:
   - 5-mark: minimum 80-100 words.
   - 10-mark: minimum 180-200 words.`;

    // Construct response schema dynamically depending on the types wanted
    const properties: any = {};
    const required: string[] = [];

    if (generate5) {
      properties.mark5 = {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "A high-scoring 5-mark answer formatted with beautiful Markdown headings and bullet points. Must be at least 80 words." },
          wordCount: { type: Type.INTEGER, description: "Exact word count of the 5-mark answer." },
        },
        required: ["text", "wordCount"],
      };
      required.push("mark5");
    }

    if (generate10) {
      properties.mark10 = {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "A comprehensive 10-mark answer styled beautifully with Markdown sections. Must be at least 180 words with deep structures." },
          wordCount: { type: Type.INTEGER, description: "Exact word count of the 10-mark answer." },
        },
        required: ["text", "wordCount"],
      };
      required.push("mark10");
    }

    const response = await generateContentWithRetry(ai, {
      contents: [
        { text: `Syllabus/Subject Module Materials:\n${materialText}` },
        { text: promptText }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties,
          required,
        },
      },
    });

    const responseText = response.text || "{}";
    // Using the new bulletproof parser
    const answerData = cleanAndParseJSON(responseText);
    res.json(answerData);
  } catch (error: any) {
    console.error("Error in generate-answers:", error);
    res.status(500).json({ error: error?.message || "Failed to generate answer for the question." });
  }
});

// Serve Vite dev server or static distribution files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TheLastMinute-Agent server running on port ${PORT}`);
  });
}

startServer();