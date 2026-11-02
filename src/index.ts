import express, { type Request, type Response } from "express";
import { config } from "dotenv";
import { ChatGoogle } from "@langchain/google";
import { TavilySearch } from "@langchain/tavily";
import { createAgent, tool } from "langchain";
import * as z from "zod";
config();

const app = express();
app.use(express.json());
const PORT = process.env.PORT;
const model = new ChatGoogle({
  model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
  apiKey: process.env.GOOGLE_API_KEY,
  maxRetries: 0,
});
const searchTool = new TavilySearch({
  maxResults: 5,
  topic: "general",
});
const additionTool = tool(
  ({ a, b }) => {
    console.log(a + b);
    return a + b;
  },
  {
    name: "addition_tool",
    description: "use this tool for addition of any two numbers",
    schema: z.object({
      a: z.number(),
      b: z.number(),
    }),
  },
);

app.post("/api/hello", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res
        .status(400)
        .json({ success: false, message: "Missing prompt" });
    }
    const agent = createAgent({
      model,
      tools: [searchTool, additionTool],
    });
    const result = await agent.invoke({
      messages: [{ role: "user", content: prompt }],
    });
    return res.status(200).json({
      success: true,
      message: result.messages[result.messages.length - 1]?.content,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, message });
  }
});
app.listen(PORT, () => {
  console.log(`Server started on ${PORT}`);
});
