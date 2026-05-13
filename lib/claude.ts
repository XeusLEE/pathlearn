import Anthropic from "@anthropic-ai/sdk";

export const hasClaudeKey = () => !!process.env.ANTHROPIC_API_KEY;

export const claude = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

export const MODEL = "claude-sonnet-4-6";
