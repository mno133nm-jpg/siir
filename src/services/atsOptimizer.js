import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeResumeAgainstJob({
  resumeText,
  jobDescription,
}) {
  if (!resumeText?.trim()) {
    throw new Error("نص السيرة الذاتية غير موجود");
  }

  if (!jobDescription?.trim()) {
    throw new Error("إعلان الوظيفة غير موجود");
  }

  const response = await openai.responses.create({
    model: "gpt-5-mini",

    instructions: `
أنت خبير في أنظمة تتبع المتقدمين ATS وتحليل السير الذاتية.

قارن السيرة الذاتية مع إعلان الوظيفة بدقة.

أعد النتيجة بصيغة JSON فقط، بدون Markdown أو شرح خارج JSON.

الصيغة المطلوبة:

{
  "score": 0,
  "summary": "",
  "matchedKeywords": [],
  "missingKeywords": [],
  "matchedSkills": [],
  "missingSkills": [],
  "experienceGaps": [],
  "recommendations": [],
  "optimizedSummary": "",
  "optimizedSkills": []
}

القواعد:
- score رقم صحيح من 0 إلى 100.
- لا تخترع مهارات أو خبرات يملكها المستخدم.
- فرّق بين الكلمات الموجودة فعلًا والكلمات الناقصة.
- اجعل التوصيات عملية وواضحة.
- optimizedSummary يجب أن يكون ملخصًا مهنيًا محسنًا ومتوافقًا مع إعلان الوظيفة، دون اختراع معلومات.
- optimizedSkills تحتوي فقط على مهارات مذكورة في السيرة أو يمكن صياغتها منطقيًا من خبرات المستخدم الحقيقية.
- لا تضف شركات أو تواريخ أو مؤهلات أو أرقامًا غير مذكورة.
`,

    input: `
السيرة الذاتية:

${resumeText}

إعلان الوظيفة:

${jobDescription}
`,
  });

  const rawResult = response.output_text?.trim();

  if (!rawResult) {
    throw new Error("لم يرجع الذكاء الاصطناعي نتيجة التحليل");
  }

  const cleanedResult = rawResult
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let result;

  try {
    result = JSON.parse(cleanedResult);
  } catch (error) {
    console.error(
      "❌ ATS JSON parse error:",
      cleanedResult
    );

    throw new Error(
      `تعذر قراءة نتيجة ATS: ${error.message}`
    );
  }

  if (
    typeof result.score !== "number" ||
    result.score < 0 ||
    result.score > 100
  ) {
    throw new Error("درجة ATS غير صالحة");
  }

  return result;
}