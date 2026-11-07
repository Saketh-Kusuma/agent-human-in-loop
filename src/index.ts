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

const model = new ChatGoogle({
  model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
  apiKey: process.env.GOOGLE_API_KEY,
  maxRetries: 0,
});

app.listen(PORT, () => {
  console.log(`Server started on ${PORT}`);
});
