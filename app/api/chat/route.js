import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req) {
  try {
    const body = await req.json();
    const { system, messages, max_tokens = 1000 } = body;
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens,
      system,
      messages,
    });
    return Response.json(response);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}