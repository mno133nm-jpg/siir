import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function ai(system, input) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content: system,
      },
      {
        role: "user",
        content: input,
      },
    ],
  });

  return JSON.parse(res.choices[0].message.content);
}