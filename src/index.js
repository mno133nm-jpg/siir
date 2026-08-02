import "dotenv/config";
import { Telegraf, Markup } from "telegraf";
import { menu } from "./bot/menu.js";

import {
  registerCompanyEmails,
  searchCompaniesByJobTitle
} from "./bot/companyEmails.js";

import { ai } from "./services/ai.js";
import { registerCV } from "./bot/cv.js";
import { getOrCreateJobTemplate } from "./services/jobTemplateService.js";
import { getJobTemplate } from "./services/jobMatcher.js";
import { db, save } from "./services/database.js";
import { searchCompanies } from "./companies.js";
import { analyzeResumeAgainstJob } from "./services/atsOptimizer.js";
import fs from "fs";
import XLSX from "xlsx";
import pdf from "pdf-parse";
import OpenAI from "openai";
import { Resend } from "resend";
import { searchJobs } from "./job-search.js";


// =====================
// Telegram
// =====================

const bot = new Telegraf(process.env.BOT_TOKEN);
const sessions = new Map();

registerCompanyEmails(bot, sessions);
registerCV(bot, sessions);

// =====================
// OpenAI
// =====================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// =====================
// Resend
// =====================

const resend = new Resend(process.env.RESEND_API_KEY);

// =====================
// Database
// =====================

const DB_FILE = "./database.json";


function user(ctx) {

  const data = db();

  const id = String(ctx.from.id);

  if (!data.users[id]) {

    data.users[id] = {

      id,

      name: ctx.from.first_name || "",

      email: "",

      cvText: "",

      profile: null

    };

    save(data);

  }

  return data.users[id];

}

// =====================
// AI
// =====================

const rules = `
أنت مستشار توظيف احترافي.

أعد النتائج بصيغة JSON فقط.

لا تضف أي شرح خارج JSON.
`;


bot.start(async (ctx) => {

  user(ctx);

await ctx.reply(
  `👋 أهلاً ${ctx.from.first_name}

🤖 أنا Sir AI

مساعدك الذكي لتطوير مسيرتك المهنية.

أستطيع مساعدتك في:

📄 تحليل السيرة الذاتية
📝 إنشاء سيرة ذاتية احترافية
🎯 تحليل الوصف الوظيفي
✉️ إنشاء Cover Letter احترافي
👤 إدارة ملفك الشخصي

اختر الخدمة التي تريدها من القائمة أدناه 👇`,

  menu()
);
});

// =====================
// Menu Buttons
// =====================

bot.action("back_to_menu", async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.reply("🏠 القائمة الرئيسية", menu());
});
bot.action("job", async (ctx) => {

  await ctx.answerCbQuery();

  const u = user(ctx);

  if (!u.profile) {

    return ctx.reply(
      "❌ حلل سيرتك الذاتية أولاً."
    );

  }

  sessions.set(ctx.from.id, {

    step: "job"

  });

  await ctx.reply(
    "📋 أرسل وصف الوظيفة."
  );

});

bot.action("jobs", async (ctx) => {

  await ctx.answerCbQuery();

  const u = user(ctx);

  if (!u.profile) {

    return ctx.reply(
      "❌ حلل سيرتك الذاتية أولاً."
    );

  }

  await ctx.reply("🔍 جاري البحث عن الوظائف...");

  try {

    const keywords =
u.profile.job_search_keywords || [];

if (!keywords.length) {
  return ctx.reply("❌ لم يتم استخراج كلمات بحث من السيرة. أعد تحليل السيرة الذاتية.");
}

let jobs = [];

for (const keyword of keywords) {

  console.log("Searching:", keyword);

const result = await searchJobs(keyword, "Saudi Arabia");

console.log("Found:", result.length);

  jobs.push(...result);

}

// حذف الوظائف المكررة
jobs = jobs.filter(
  (job, index, self) =>
    index === self.findIndex(
      j => j.applyUrl === job.applyUrl
    )
);

    if (!jobs.length) {

      return ctx.reply(
        "❌ لم أجد وظائف."
      );

    }

    for (const job of jobs.slice(0, 5)) {

      await ctx.reply(

`🏢 ${job.company}

💼 ${job.title}

📍 ${job.location}

🔗 ${job.applyUrl || "لا يوجد رابط"}`

      );

    }

  } catch (err) {

    console.error(err);

    await ctx.reply(
      "❌ حدث خطأ أثناء البحث."
    );

  }

});

bot.action("apply_companies", async (ctx) => {
  await ctx.answerCbQuery();


  await ctx.reply(


  );
});
bot.action("create_cv", async (ctx) => {
  await ctx.answerCbQuery();

  sessions.set(ctx.from.id, {
    step: "create_cv_type",
    cvData: {}
  });

  await ctx.reply(
    `📝 إنشاء سيرة ذاتية

اختر حالتك المهنية حتى نكتب السيرة بأسلوب يناسبك:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "🎓 حديث تخرج",
          "cv_type_fresh"
        )
      ],
      [
        Markup.button.callback(
          "💼 لدي خبرة عملية",
          "cv_type_experienced"
        )
      ],
      [
        Markup.button.callback(
          "👔 مدير أو قائد فريق",
          "cv_type_manager"
        )
      ],
      [
        Markup.button.callback(
          "❌ إلغاء",
          "create_cv_cancel"
        )
      ]
    ])
  );
});
bot.action("cv_type_fresh", async (ctx) => {
  await ctx.answerCbQuery();

  const session = sessions.get(ctx.from.id);

  if (!session) {
    await ctx.reply("❌ انتهت الجلسة، ابدئي من جديد.");
    return;
  }

  session.cvData.userType = "fresh";
  session.step = "create_cv_name";
  sessions.set(ctx.from.id, session);

  await ctx.reply(
    `🎓 سيتم إعداد السيرة بأسلوب مناسب لحديثي التخرج، مع التركيز على التعليم والمهارات والتدريب والمشاريع.

👤 ما اسمك الكامل؟`
  );
});

bot.action("cv_type_experienced", async (ctx) => {
  await ctx.answerCbQuery();

  const session = sessions.get(ctx.from.id);

  if (!session) {
    await ctx.reply("❌ انتهت الجلسة، ابدئي من جديد.");
    return;
  }

  session.cvData.userType = "experienced";
  session.step = "create_cv_name";
  sessions.set(ctx.from.id, session);

  await ctx.reply(
    `💼 سيتم إعداد السيرة بأسلوب يركز على الخبرات والمهام والإنجازات المهنية.

👤 ما اسمك الكامل؟`
  );
});

bot.action("cv_type_manager", async (ctx) => {
  await ctx.answerCbQuery();

  const session = sessions.get(ctx.from.id);

  if (!session) {
    await ctx.reply("❌ انتهت الجلسة، ابدئي من جديد.");
    return;
  }

  session.cvData.userType = "manager";
  session.step = "create_cv_name";
  sessions.set(ctx.from.id, session);

  await ctx.reply(
    `👔 سيتم إعداد السيرة بأسلوب قيادي يركز على إدارة الفرق وتحسين الأداء وتحقيق النتائج.

👤 ما اسمك الكامل؟`
  );
});
bot.action("cover", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    "✉️ أرسل الوصف الوظيفي وسأكتب لك Cover Letter احترافي يناسب الوظيفة."
  );
});
bot.action("profile", async (ctx) => {

  await ctx.answerCbQuery();

  const u = user(ctx);

  console.log("PROFILE:", u.profile);
console.log("KEYWORDS:", u.profile?.job_search_keywords);
console.log("TARGET:", u.profile?.target_job_titles);

  if (!u.profile) {

    return ctx.reply(
      "لم يتم تحليل السيرة بعد."
    );

  }

  await ctx.reply(

`👤 الملف الشخصي

🎯 المسميات:

${(u.profile.target_job_titles || []).join("، ")}

🛠 المهارات:

${(u.profile.skills || []).join("، ")}

📄 الملخص:

${u.profile.summary || ""}`

  );

});
// =====================
// CV Analysis
// =====================

bot.on("document", async (ctx) => {

  const s = sessions.get(ctx.from.id);

  if (!s || s.step !== "cv") {
    return;
  }

  const file = ctx.message.document;

  if (!file.file_name.toLowerCase().endsWith(".pdf")) {
    return ctx.reply("❌ الرجاء إرسال ملف PDF فقط.");
  }

  await ctx.reply("⏳ جاري تحليل السيرة الذاتية...");

  try {

    const link = await ctx.telegram.getFileLink(file.file_id);

    const response = await fetch(link);

    const buffer = Buffer.from(await response.arrayBuffer());

    const text = (await pdf(buffer)).text;

    const profile = await ai(


      rules +

      `
أعد JSON فقط بالمفاتيح التالية:

{
 "summary":"",
 "skills":[],
 "experiences":[],
 "education":[],
 "target_job_titles":[],
 "job_search_keywords":[],
 "years_of_experience":0,
 "preferred_cities":[]
}

استخرج 5 كلمات بحث مناسبة لمواقع التوظيف مثل Jooble وLinkedIn.

إذا كانت السيرة في الموارد البشرية فأعد مثلاً:
["Human Resources","HR Specialist","Recruitment","HR Coordinator","Talent Acquisition"]

إذا كانت في المحاسبة:
["Accountant","Accounting","Finance","Financial Analyst","Bookkeeper"]

إذا كانت في البرمجة:
["Software Engineer","Backend Developer","Node.js","JavaScript","Full Stack Developer"]
`,

      text

    );
console.log(JSON.stringify(profile, null, 2));
console.log("PROFILE:");
console.log(profile);

    const data = db();

    data.users[String(ctx.from.id)].cvText = text;
    data.users[String(ctx.from.id)].profile = profile;

    save(data);


    await ctx.reply(

`✅ تم تحليل السيرة بنجاح

🎯 المسميات المناسبة:

${(profile.target_job_titles || []).join("، ")}

🛠 المهارات:

${(profile.skills || []).join("، ")}

👤 الملخص:

${profile.summary || ""}`,

      menu()

    );

  } catch (err) {

    console.error(err);

    await ctx.reply("❌ حدث خطأ أثناء تحليل السيرة.");

  }

});
// =====================
// Job Analysis
// =====================

bot.on("text", async (ctx) => {
  // تجاهل الأوامر
  if (ctx.message.text.startsWith("/")) return;

  const s = sessions.get(ctx.from.id);

  if (!s) return;

  const u = user(ctx);

if (s.step === "ats_waiting_job_description") {
  const jobDescription = ctx.message.text.trim();

  if (jobDescription.length < 2) {
    return ctx.reply(
      "❌ أرسل إعلان الوظيفة أو اكتب المسمى الوظيفي."
    );
  }

  s.cvData = s.cvData || {};
  s.cvData.jobDescription = jobDescription;
  s.step = "create_cv_type";

  sessions.set(ctx.from.id, s);

  return ctx.reply(
    `👤 اختر حالتك المهنية حتى نكتب السيرة بما يناسب إعلان الوظيفة:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "🎓 حديث تخرج",
          "cv_type_fresh"
        )
      ],
      [
        Markup.button.callback(
          "💼 لدي خبرة عملية",
          "cv_type_experienced"
        )
      ],
      [
        Markup.button.callback(
          "👔 مدير أو قائد فريق",
          "cv_type_manager"
        )
      ],
      [
        Markup.button.callback(
          "❌ إلغاء",
          "create_cv_cancel"
        )
      ]
    ])
  );
}   



  // =====================
  // إنشاء سيرة ذاتية
  // =====================

  if (s.step === "create_cv_name") {
    s.cvData.name = ctx.message.text.trim();
    s.step = "create_cv_phone";

    sessions.set(ctx.from.id, s);

    return ctx.reply(
      "📱 اكتب رقم الجوال مع مفتاح الدولة، مثال:\n+966500000000"
    );
  }

  if (s.step === "create_cv_phone") {
    s.cvData.phone = ctx.message.text.trim();
    s.step = "create_cv_email";

    sessions.set(ctx.from.id, s);

    return ctx.reply("📧 ما بريدك الإلكتروني؟");
  }

  if (s.step === "create_cv_email") {
    const email = ctx.message.text.trim();

    if (!email.includes("@")) {
      return ctx.reply(
        "❌ البريد الإلكتروني غير صحيح، اكتبه مرة أخرى."
      );
    }

    s.cvData.email = email;
    s.step = "create_cv_city";

    sessions.set(ctx.from.id, s);

    return ctx.reply("📍 في أي مدينة تسكن؟");
  }

  if (s.step === "create_cv_city") {
    s.cvData.city = ctx.message.text.trim();
    s.step = "create_cv_job_title";

    sessions.set(ctx.from.id, s);

    return ctx.reply(
      "🎯 ما المسمى الوظيفي الذي تستهدفه؟\nمثال: أخصائي موارد بشرية"
    );
  }

  if (s.step === "create_cv_job_title") {
   s.cvData.jobTitle = ctx.message.text.trim();
    s.step = "create_cv_education";

    sessions.set(ctx.from.id, s);

    return ctx.reply(
      `🎓 اكتب مؤهلك الدراسي.

مثال:
بكالوريوس إدارة أعمال
جامعة القصيم
2024`
    );
  }

  if (s.step === "create_cv_education") {
    s.cvData.education = ctx.message.text.trim();
    s.step = "create_cv_experience";

    sessions.set(ctx.from.id, s);

    return ctx.reply(
      `💼 اكتب خبراتك العملية.

مثال:
أخصائي موارد بشرية في شركة س
من 2022 إلى 2024
المهام: التوظيف وإدارة ملفات الموظفين

إذا لم توجد خبرة اكتب: حديث تخرج`
    );
  }

  if (s.step === "create_cv_experience") {
    s.cvData.experience = ctx.message.text.trim();
    s.step = "create_cv_skills";

    sessions.set(ctx.from.id, s);

    return ctx.reply(
      `🛠 اكتب مهاراتك مفصولة بفاصلة.

مثال:
التواصل، Microsoft Excel، التوظيف، العمل الجماعي`
    );
  }

  if (s.step === "create_cv_skills") {
    s.cvData.skills = ctx.message.text
      .split(/[,،\n]/)
      .map((skill) => skill.trim())
      .filter(Boolean);

    s.step = "create_cv_languages";

    sessions.set(ctx.from.id, s);

    return ctx.reply(
      `🌐 اكتب اللغات ومستواك فيها.

مثال:
العربية: اللغة الأم
الإنجليزية: جيد جدًا`
    );
  }

  if (s.step === "create_cv_languages") {
    s.cvData.languages = ctx.message.text.trim();
    s.step = "create_cv_courses";

    sessions.set(ctx.from.id, s);

    return ctx.reply(
      `📚 اكتب الدورات والشهادات.

إذا لم توجد، اكتب: لا يوجد`
    );
  }

  if (s.step === "create_cv_courses") {
    s.cvData.courses = ctx.message.text.trim();

    const cvData = s.cvData;

    sessions.set(ctx.from.id, {
      step: "create_cv_confirm",
      cvData
    });

    return ctx.reply(
      `✅ راجع بياناتك:

👤 الاسم:
${cvData.name}

📱 الجوال:
${cvData.phone}

📧 البريد:
${cvData.email}

📍 المدينة:
${cvData.city}

🎯 المسمى المستهدف:
${cvData.targetJobTitle}

🎓 التعليم:
${cvData.education}

💼 الخبرة:
${cvData.experience}

🛠 المهارات:
${cvData.skills.join("، ")}

🌐 اللغات:
${cvData.languages}

📚 الدورات:
${cvData.courses}

هل البيانات صحيحة؟`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "✅ إنشاء السيرة",
            "create_cv_generate"
          )
        ],
        [
          Markup.button.callback(
            "🔄 البدء من جديد",
            "create_cv"
          )
        ],
        [
          Markup.button.callback(
            "❌ إلغاء",
            "create_cv_cancel"
          )
        ]
      ])
    );
  }

  if (s.step === "emails_city") {

  const city = ctx.message.text;

  const result = searchCompanies(city, 20);

  sessions.delete(ctx.from.id);

  if (!result.length) {
    return ctx.reply("❌ لا توجد نتائج.");
  }

  let text = `📧 وجدنا ${result.length} نتيجة\n\n`;

  result.forEach((c, i) => {

    text += `${i + 1}.\n`;
    text += `🏢 ${c.Company}\n`;
    text += `📧 ${c.Email}\n\n`;

  });

  return ctx.reply(text);

}

  // =====================
  // تحليل الوظيفة
  // =====================

  if (s.step === "job") {

    if (!u.profile) {
      return ctx.reply("❌ حلل سيرتك الذاتية أولاً.");
    }

    await ctx.reply("⏳ جاري تحليل الوظيفة...");

    try {

      const result = await ai(

        rules +

`
قارن السيرة مع الوظيفة.

أعد JSON فقط:

{
"job_title":"",
"company_name":"",
"match_score":0,
"strengths":[],
"gaps":[],
"recommendation":"",
"cover_letter":""
}
`,

`PROFILE:
${JSON.stringify(u.profile)}

JOB:

${ctx.message.text}`

      );

      sessions.set(ctx.from.id,{
        step:"job_result",
        result
      });

      return ctx.reply(

`🎯 نسبة التوافق: ${result.match_score}%

🟢 نقاط القوة

${(result.strengths || []).join("\n")}

🟡 الفجوات

${(result.gaps || []).join("\n")}

💡 ${result.recommendation}`,

{
reply_markup:{
inline_keyboard:[
[
{
text:"✉️ تجهيز الإيميل",
callback_data:"send_job"
}
]
]
}
}

      );

    } catch(err){

      console.error(err);

      return ctx.reply("❌ فشل تحليل الوظيفة.");

    }

  }

  // =====================
  // استقبال الإيميل
  // =====================

  if(s.step==="email_to"){

    sessions.set(ctx.from.id,{
      step:"email_send",
      email:ctx.message.text,
      result:s.result
    });

    return ctx.reply(
`سيتم الإرسال إلى:

${ctx.message.text}

اكتب:

نعم`
    );

  }

  // =====================
  // إرسال الإيميل
  // =====================

  if(
    s.step==="email_send" &&
    ctx.message.text.trim()==="نعم"
  ){

    try{

      await resend.emails.send({

        from:process.env.FROM_EMAIL,

        to:s.email,

        subject:`التقديم على ${s.result.job_title}`,

        text:s.result.cover_letter

      });


      return ctx.reply(
        "✅ تم إرسال الإيميل.",
        menu()
      );

    }catch(err){

      console.error(err);

      return ctx.reply(
        "❌ فشل إرسال الإيميل."
      );

    }

  }

});
// =====================
// Send Job Button
// =====================
bot.action("create_cv_cancel", async (ctx) => {
  await ctx.answerCbQuery();

  sessions.delete(ctx.from.id);

  return ctx.reply(
    "❌ تم إلغاء إنشاء السيرة الذاتية.",
    menu()
  );
});
bot.action("create_cv_generate", async (ctx) => {
  await ctx.answerCbQuery();

  const userId = ctx.from.id;
  const session = sessions.get(userId);

  if (!session?.cvData) {
    await ctx.reply(
      "❌ لم أجد بيانات السيرة الذاتية.\n\nابدئي من جديد من خلال زر إنشاء سيرة ذاتية."
    );
    return;
  }
const data = session.cvData;
const jobDescription =
  data.jobDescription || "";

const jobTitle =
  data.jobTitle ||
  data.targetJobTitle ||
  data.jobDescription ||
  "";

const loadingMessage = await ctx.reply(
  "⏳ جاري إنشاء سيرتك الذاتية بالذكاء الاصطناعي..."
);

try {
console.log("🔎 المسمى المطلوب:", jobTitle);
  console.log("📌 قبل استدعاء القالب:", data.jobTitle);

  console.log("📌 سيتم استدعاء getOrCreateJobTemplate");

const jobTemplateResult =
  await getOrCreateJobTemplate(jobTitle);

  console.log("📌 انتهى استدعاء getOrCreateJobTemplate");

  console.log(
    "📚 مصدر القالب:",
    jobTemplateResult?.source
  );

  const jobTemplate =
    jobTemplateResult?.template || null;

  const jobKnowledge = jobTemplate
    ? `
بيانات مهنية معتمدة للمسمى الوظيفي:

المسمى:
${jobTemplate.title}

المهارات المقترحة:
- ${jobTemplate.skills.join("\n- ")}

المسؤوليات الشائعة:
- ${jobTemplate.responsibilities.join("\n- ")}

الإنجازات المهنية الشائعة:
- ${jobTemplate.achievements.join("\n- ")}

الكلمات المفتاحية لأنظمة ATS:
${jobTemplate.keywords.join(", ")}
`
    : `
لا يوجد قالب داخلي مطابق لهذا المسمى.
استنتج مهارات ومسؤوليات وإنجازات واقعية ومناسبة للمسمى، دون اختراع شركات أو تواريخ أو أرقام.
`;

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

إذا كان إعلان الوظيفة يحتوي على مسمى وظيفي فقط:
- استنتج الكلمات المفتاحية والمهارات والمسؤوليات الشائعة لهذا المسمى.
- وضّح أن التحليل تقديري لأنه لا يوجد وصف وظيفي كامل.
- لا تخترع متطلبات محددة لشركة بعينها.
`,

    input: `
أنشئ سيرة ذاتية احترافية من البيانات التالية:

إعلان الوظيفة أو المسمى الوظيفي:

${jobDescription}

اجعل السيرة الذاتية متوافقة مع هذا الإعلان.
استخرج الكلمات المفتاحية المناسبة من الإعلان، لكن لا تضف أي خبرة أو مهارة غير موجودة في بيانات المستخدم.
إذا كان المدخل مسمى وظيفيًا فقط، استخدم المتطلبات الشائعة لهذا المسمى دون اختراع معلومات.

${jobKnowledge}

استخدم البيانات المهنية السابقة كأساس لصياغة السيرة.
لا تنسخها حرفيًا كلها، بل اختر الأنسب منها حسب بيانات المستخدم ونوعه المهني.

نوع المستخدم المهني: ${
      data.userType === "fresh"
        ? "حديث تخرج"
        : data.userType === "manager"
        ? "مدير أو قائد فريق"
        : "لديه خبرة عملية"
    }

الاسم الكامل: ${data.name || "غير متوفر"}
رقم الجوال: ${data.phone || "غير متوفر"}
البريد الإلكتروني: ${data.email || "غير متوفر"}
المدينة: ${data.city || "غير متوفر"}
المسمى الوظيفي المستهدف: ${jobTitle || "غير متوفر"}
التعليم: ${data.education || "غير متوفر"}
الخبرات العملية: ${data.experience || "غير متوفر"}
المهارات: ${data.skills || "غير متوفر"}
اللغات: ${data.languages || "غير متوفر"}
الدورات والشهادات: ${data.courses || "غير متوفر"}
`
  });

  const cvText = response.output_text?.trim();

  if (!cvText) {
    throw new Error("لم يرجع الذكاء الاصطناعي نص السيرة.");
  }

  session.generatedCV = cvText;
  session.step = "cv_generated";
  sessions.set(userId, session);

  try {
    await ctx.telegram.deleteMessage(
      ctx.chat.id,
      loadingMessage.message_id
    );
  } catch (deleteError) {
    console.log(
      "تعذر حذف رسالة الانتظار:",
      deleteError.message
    );
  }

  const telegramLimit = 3900;

  if (cvText.length <= telegramLimit) {
    await ctx.reply(cvText);
  } else {
    for (
      let i = 0;
      i < cvText.length;
      i += telegramLimit
    ) {
      await ctx.reply(
        cvText.slice(i, i + telegramLimit)
      );
    }
  }

  await ctx.reply(
    "✅ تم إنشاء سيرتك الذاتية بنجاح.",
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "📄 تحويل إلى PDF",
          "create_cv_pdf"
        )
      ],
      [
  Markup.button.callback(
    "🎯 تحسين السيرة لإعلان وظيفة",
    "ats_optimize"
  )
],

      [
        Markup.button.callback(
          "🔄 إنشاء نسخة جديدة",
          "create_cv"
        )
      ],
      [
        Markup.button.callback(
          "🏠 القائمة الرئيسية",
          "main_menu"
        )
      ]
    ])
  );
} catch (error) {
  console.error(
    "❌ CV or template generation error:",
    error
  );

  try {
    await ctx.telegram.deleteMessage(
      ctx.chat.id,
      loadingMessage.message_id
    );
  } catch (deleteError) {
    console.log(
      "تعذر حذف رسالة الانتظار:",
      deleteError.message
    );
  }

  await ctx.reply(
    "❌ حدث خطأ أثناء إنشاء السيرة الذاتية. حاولي مرة أخرى."
  );
}

});

bot.action("ats_optimize", async (ctx) => {
  await ctx.answerCbQuery();

  const userId = ctx.from.id;

  sessions.set(userId, {
    step: "ats_waiting_job_description",
    cvData: {},
    atsMode: true
  });

  return ctx.reply(
    `🎯 أرسل إعلان الوظيفة كاملًا.

إذا لم يوجد وصف، أرسل المسمى الوظيفي فقط.

مثال:
• محاسب
• موظف خدمة عملاء
• مدير مبيعات`
  );
});

bot.action("send_job", async (ctx) => {

  await ctx.answerCbQuery();

  const s = sessions.get(ctx.from.id);

  if (!s || !s.result) {
    return ctx.reply("❌ لا يوجد تحليل وظيفة.");
  }

  sessions.set(ctx.from.id, {
    step: "email_to",
    result: s.result
  });

  await ctx.reply("📧 أرسل بريد الشركة الإلكتروني.");

});

// =====================
// Error Handler
// =====================

bot.catch((err) => {

  console.error("BOT ERROR:");
  console.error(err);

});

// =====================
// Launch
// =====================
bot.launch();


console.log("✅ Sir AI Telegram Bot is running");

// =====================
// Stop
// =====================

process.once("SIGINT", () => bot.stop("SIGINT"));

process.once("SIGTERM", () => bot.stop("SIGTERM"));