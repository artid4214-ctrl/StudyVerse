import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

if (!process.env.GEMINI_API_KEY) {
  console.error("ERROR: GEMINI_API_KEY is missing from .env");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

app.use(express.json({ limit: "2mb" }));

app.use(express.static(path.join(__dirname, "..")));

/* ---------------- HEALTH ---------------- */

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "StudyVerse AI"
  });
});

/* ---------------- CHAT ---------------- */

app.post("/api/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages)
      ? req.body.messages
      : [];

    const safeMessages = messages
      .filter(
        (message) =>
          message &&
          (message.role === "user" ||
            message.role === "assistant") &&
          typeof message.content === "string"
      )
      .slice(-20)
      .map((message) => ({
        role: message.role,
        content: message.content.slice(0, 12000)
      }));

    if (
      !safeMessages.length ||
      !safeMessages.some(
        (message) => message.role === "user"
      )
    ) {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

    const conversation = safeMessages
      .map((message) => {
        const role =
          message.role === "assistant"
            ? "StudyVerse AI"
            : "User";

        return `${role}: ${message.content}`;
      })
      .join("\n\n");

    const systemInstruction = `
You are StudyVerse AI, a helpful general-purpose AI assistant.

CREATOR:
StudyVerse AI was created and developed by Ganesh.
If asked who created StudyVerse AI, say that Ganesh created and developed StudyVerse AI.
Do not claim Ganesh created Google, Gemini, or the underlying AI model.

LANGUAGE:
- Automatically match the user's language.
- Support English, Hindi, Hinglish and other languages.
- If the user writes Hinglish, reply naturally in Hinglish.

STYLE:
- Be friendly and natural.
- Use emojis when appropriate.
- Use Markdown formatting.
- Use headings, bold text, bullet points and numbered lists when useful.
- Use code blocks for code.
- Keep simple questions concise.
- Give detailed explanations when requested.

STUDY:
- Help with Class 10 school subjects.
- Explain at an appropriate Class 10 level.
- Show steps for Maths and Science calculations.
- Prioritize accuracy.
- Do not invent facts.

GENERAL:
StudyVerse is also a general-purpose AI assistant.
Answer normal questions naturally, even when they are not related to studying.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: conversation,
      config: {
        systemInstruction
      }
    });

    const reply = response.text?.trim();

    if (!reply) {
      return res.status(502).json({
        error: "Gemini returned an empty response."
      });
    }

    res.json({ reply });

  } catch (error) {
    console.error("StudyVerse Gemini error:", error);

    const status = error?.status || error?.statusCode;

    if (status === 401 || status === 403) {
      return res.status(status).json({
        error: "Gemini API key is invalid or not authorized."
      });
    }

    if (status === 429) {
      return res.status(429).json({
        error: "Gemini rate limit reached. Please try again later."
      });
    }

    if (status === 503) {
      return res.status(503).json({
        error: "Gemini is temporarily busy. Please try again."
      });
    }

    res.status(500).json({
      error: error?.message || "Unexpected server error."
    });
  }
});

/* ---------------- IMAGE GENERATION ---------------- */

app.post("/api/image", async (req, res) => {
  try {
    const prompt =
      typeof req.body?.prompt === "string"
        ? req.body.prompt.trim()
        : "";

    if (!prompt) {
      return res.status(400).json({
        error: "Please enter an image prompt."
      });
    }

    if (prompt.length > 4000) {
      return res.status(400).json({
        error: "Image prompt is too long."
      });
    }

    console.log("Generating image...");

    const interaction = await ai.interactions.create({
      model: "gemini-nano-banana-2.1",
      input: prompt,
      response_format: {
        type: "image",
        mime_type: "image/png",
        aspect_ratio: "1:1",
        image_size: "1K"
      }
    });

    const generatedImage = interaction.output_image;

    if (!generatedImage?.data) {
      return res.status(502).json({
        error: "Gemini did not return an image."
      });
    }

    console.log("Image generated successfully.");

    res.json({
      success: true,
      mimeType: generatedImage.mime_type || "image/png",
      image: generatedImage.data
    });

  } catch (error) {
    console.error("StudyVerse image error:", error);

    const status =
      error?.status ||
      error?.statusCode ||
      error?.response?.status;

    if (status === 401 || status === 403) {
      return res.status(status).json({
        error: "Gemini API key is invalid or image generation is not authorized."
      });
    }

    if (status === 429) {
      return res.status(429).json({
        error: "Image generation rate limit reached. Please try again later."
      });
    }

    if (status === 503) {
      return res.status(503).json({
        error: "Image generation is temporarily busy. Please try again."
      });
    }

    res.status(500).json({
      error:
        error?.message ||
        "Unexpected image generation error."
    });
  }
});

/* ---------------- START ---------------- */

app.listen(PORT, () => {
  console.log("");
  console.log("================================");
  console.log("   StudyVerse AI is running!");
  console.log("================================");
  console.log(`Website: http://localhost:${PORT}`);
  console.log(`Health:  http://localhost:${PORT}/health`);
  console.log("Chat:    Gemini");
  console.log("Images:  Gemini Nano Banana");
  console.log("");
});
