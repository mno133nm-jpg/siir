import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";
import { menu } from "./bot/menu.js";
import { ai } from "./services/ai.js";
import { registerCV } from "./bot/cv.js";
import { db, save } from "./services/database.js";
import { searchCompanies } from "./companies.js";
import fs from "fs";
import XLSX from "xlsx";
import pdf from "pdf-parse";
import OpenAI from "openai";
import { Resend } from "resend";
import { searchJobs } from "./job-search.js";

dotenv.config();

// =====================
// Telegram
// =====================

const bot = new Telegraf(process.env.BOT_TOKEN);

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

bot.action("emails", async (ctx) => {

  await ctx.answerCbQuery();

  await ctx.reply(
    "📍 اختر المنطقة",
    {
      reply_markup: {
        inline_keyboard: [

          [
            { text: "الرياض", callback_data: "city_الرياض" },
            { text: "الشرقية", callback_data: "city_الشرقية" }
          ],

          [
            { text: "القصيم", callback_data: "city_القصيم" },
            { text: "الغربية", callback_data: "city_الغربية" }
          ],

          [
            { text: "الجنوب", callback_data: "city_الجنوب" },
             { text: "الكل", callback_data: "city_الكل" }
          ],

        ]
      }
    }
  );

});
bot.action(/^emails20_(.+)$/, async (ctx)=>{

    const city = ctx.match[1];

    const result = searchCompanies(city,20);

    let text="";

    result.forEach((c,i)=>{

        text += `${i+1}. ${c.Email}\n`;

    });

    await ctx.reply(text);

});
bot.action(/^emails50_(.+)$/, async (ctx)=>{

    const city = ctx.match[1];

    const result = searchCompanies(city,50);

    let text="";

    result.forEach((c,i)=>{

        text += `${i+1}. ${c.Email}\n`;

    });

    await ctx.reply(text);

});
bot.action(/^emails100_(.+)$/, async (ctx)=>{

    const city = ctx.match[1];

    const result = searchCompanies(city,100);

    let text="";

    result.forEach((c,i)=>{

        text += `${i+1}. ${c.Email}\n`;

    });

    await ctx.reply(text);

});
bot.action(/^city_(.+)$/, async (ctx) => {

  await ctx.answerCbQuery();

  const city = ctx.match[1];

const result = searchCompanies(city, 999999);

await ctx.reply(
`📍 ${city}

وجدت ${result.length} إيميل.

اختر العدد:`,
{
  reply_markup:{
    inline_keyboard:[
      [
        {text:"20",callback_data:`emails20_${city}`},
        {text:"50",callback_data:`emails50_${city}`}
      ],
      [
        {text:"100",callback_data:`emails100_${city}`}
      ],
      [
        {text:"📥 تحميل Excel",callback_data:`excel_${city}`}
      ]
    ]
  }

});

});
bot.action(/^excel_(.+)$/, async (ctx) => {

  await ctx.answerCbQuery();

  const city = ctx.match[1];

  // سيتم كتابة كود إنشاء ملف Excel هنا

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
  await ctx.reply(
    "📝 قريبًا ستتمكن من إنشاء سيرة ذاتية احترافية بالكامل بالذكاء الاصطناعي."
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

    sessions.delete(ctx.from.id);

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

      sessions.delete(ctx.from.id);

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
registerCV(bot, sessions);
bot.launch();


console.log("✅ Sir AI Telegram Bot is running");

// =====================
// Stop
// =====================

process.once("SIGINT", () => bot.stop("SIGINT"));

process.once("SIGTERM", () => bot.stop("SIGTERM"));