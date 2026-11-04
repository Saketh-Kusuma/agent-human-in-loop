import express, { type Request, type Response } from "express";
import { config } from "dotenv";
import { ChatGoogle } from "@langchain/google";
import { TavilySearch } from "@langchain/tavily";
import { AIMessage, BaseMessage, createAgent, tool } from "langchain";
import * as z from "zod";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  MemorySaver,
  MessagesAnnotation,
  MessagesValue,
  StateGraph,
  StateSchema,
  type ConditionalEdgeRouter,
  type GraphNode,
} from "@langchain/langgraph";
import { MongoClient } from "mongodb";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
config();

const app = express();
app.use(express.json());
const PORT = process.env.PORT;
const client = new MongoClient("mongodb://localhost:27017/");
const searchTool = new TavilySearch({
  maxResults: 5,
  topic: "general",
});
const additionTool = tool(
  ({ a, b }) => {
    console.log("Addition tool called: " + a + b);
    return a + b;
  },
  {
    name: "addition_tool",
    description: "can be used to add two numbers",
    schema: z.object({
      a: z.number(),
      b: z.number(),
    }),
  },
);
const tools = [searchTool, additionTool];
const model = new ChatGoogle({
  model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
  apiKey: process.env.GOOGLE_API_KEY,
  maxRetries: 0,
}).bindTools(tools);
const checkpointer = new MongoDBSaver({
  client: client as any,
  dbName: "langraph",
});
const toolNode = new ToolNode(tools);
const agentNode = async (state: typeof MessagesAnnotation.State) => {
  const result = await model.invoke(state.messages);
  return {
    messages: [result],
  };
};
const shouldContinue = (state: typeof MessagesAnnotation.State) => {
  const lastMessage = state.messages[state.messages.length - 1];
  if (
    lastMessage instanceof AIMessage &&
    lastMessage.tool_calls &&
    lastMessage.tool_calls.length > 0
  ) {
    console.log("calling tool node");
    return "tool_node";
  } else {
    return "__end__";
  }
};
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", agentNode)
  .addNode("tool_node", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tool_node", "agent")
  .compile({ checkpointer });
app.post("/api/hello", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res
        .json(400)
        .json({ success: false, message: "Not a valid prompt" });
    }
    const result = await graph.invoke(
      {
        messages: [
          {
            role: "human",
            content: prompt,
          },
        ],
      },
      { configurable: { thread_id: "user-123" } },
    );
    return res.status(200).json({
      success: true,
      message: result.messages[result.messages.length - 1]?.content,
    });
  } catch (error) {
    return res.status(500).json({ success: false, mesaage: error });
  }
});
app.listen(PORT, () => {
  console.log(`Server started on ${PORT}`);
});
