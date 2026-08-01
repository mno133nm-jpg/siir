import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateJobTemplate(jobTitle) {
  const response = await client.responses.create({
    model: "gpt-5-mini",

    input: `
أنشئ قالب JSON احترافي لهذا المسمى الوظيفي:

${jobTitle}

أعد فقط JSON بدون أي شرح.

الصيغة المطلوبة:

{
"title":"",
"skills":[],
"responsibilities":[],
"achievements":[],
"keywords":[]
}

الشروط:

- 8 مهارات
- 5 مسؤوليات
- 5 إنجازات عامة
- 6 كلمات ATS

لا تخترع شركات.
لا تخترع أرقام.
لا تضف Markdown.
`
  });

  return response.output_text;
}