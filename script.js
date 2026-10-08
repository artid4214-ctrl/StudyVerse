import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8080;

if (!process.env.OPENAI_API_KEY) {
  console.log("ERROR: OPENAI_API_KEY is missing.");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "StudyVerse AI"
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages)
      ? req.body.messages
      : [];

    const safeMessages = messages
      .filter(
        m =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .slice(-30)
      .map(m => ({
        role: m.role,
        content: m.content.slice(0, 12000)
      }));

    if (!safeMessages.some(m => m.role === "user")) {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OpenAI API key is not configured."
      });
    }

    const response = await client.responses.create({
      model: "gpt-5.5",

      instructions:
        "You are StudyVerse AI, a helpful general-purpose AI assistant. " +
        "StudyVerse was created and developed by Ganesh. " +
        "Do not claim Ganesh created OpenAI or the underlying AI model. " +
        "Automatically match the user's language, including English, Hindi and Hinglish. " +
        "Use clear headings, bullets, numbered lists, bold text and code blocks when useful. " +
        "For Class 10 school questions, prioritize accuracy and explain at an appropriate level. " +
        "Do not invent facts.",

      input: safeMessages
    });

    const reply = response.output_text?.trim();

    if (!reply) {
      return res.status(502).json({
        error: "The AI returned an empty response."
      });
    }

    res.json({ reply });

  } catch (error) {
    console.error("StudyVerse API error:", error);

    res.status(error?.status || 500).json({
      error: error?.message || "Something went wrong."
    });
  }
});

app.listen(PORT, () => {
  console.log(`StudyVerse AI running at http://localhost:${PORT}`);
});