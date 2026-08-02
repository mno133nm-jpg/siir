import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { Markup } from "telegraf";

const EXCEL_PATH = path.resolve("companies.xlsx");
const PAGE_SIZE = 50;

const regions = {
  riyadh: {
    name: "الرياض",
    emoji: "📍",
    keywords: ["الرياض"]
  },
  eastern: {
    name: "الشرقية",
    emoji: "🌊",
    keywords: [
      "الشرقية",
      "الدمام",
      "الخبر",
      "الظهران",
      "الأحساء",
      "الجبيل",
      "القطيف"
    ]
  },
  western: {
    name: "الغربية",
    emoji: "🌴",
    keywords: [
      "الغربية",
      "جدة",
      "مكة",
      "المدينة",
      "الطائف",
      "ينبع"
    ]
  },
  south: {
    name: "الجنوب",
    emoji: "⛰️",
    keywords: [
      "الجنوب",
      "أبها",
      "خميس مشيط",
      "جازان",
      "نجران",
      "الباحة",
      "عسير"
    ]
  },
  qassim: {
    name: "القصيم",
    emoji: "🌾",
    keywords: [
      "القصيم",
      "بريدة",
      "عنيزة",
      "الرس"
    ]
  },
  north: {
    name: "الشمال",
    emoji: "🏔️",
    keywords: [
      "الشمال",
      "تبوك",
      "حائل",
      "الجوف",
      "عرعر",
      "سكاكا",
      "القريات"
    ]
  },
  all: {
    name: "كل المناطق",
    emoji: "📩",
    keywords: []
  }
};

function readCompanies() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(
      "ملف companies.xlsx غير موجود في المجلد الرئيسي للمشروع."
    );
  }

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: ""
  });

  return rows
    .map((row) => ({
      email: String(row.Email || "").trim(),
      city: String(row.City || "").trim(),
      company: String(row.Company || "").trim(),
      jobTitle: String(row["المسمى الوظيفي"] || "").trim()
    }))
    .filter((row) => row.email);
}

function getCompaniesByRegion(regionId) {
  const companies = readCompanies();

  if (regionId === "all") {
    return companies;
  }

  const region = regions[regionId];

  if (!region) {
    return [];
  }

  return companies.filter((company) =>
    region.keywords.some((keyword) =>
      company.city.includes(keyword)
    )
  );
}

function formatCompany(company, number) {
  const parts = [`${number}. 🏢 ${company.company || "شركة غير محددة"}`];

  if (company.email) {
    parts.push(`📧 ${company.email}`);
  }

  if (company.city) {
    parts.push(`📍 ${company.city}`);
  }

  if (company.jobTitle) {
    parts.push(`💼 ${company.jobTitle}`);
  }

  return parts.join("\n");
}

/**
 * يقسم القائمة إلى رسائل لا تتجاوز حد تيليجرام.
 */
function createTelegramMessages(companies, startingNumber) {
  const messages = [];
  let currentMessage = "";

  companies.forEach((company, index) => {
    const formatted = formatCompany(
      company,
      startingNumber + index
    );

    const separator = currentMessage
      ? "\n\n━━━━━━━━━━━━━━\n\n"
      : "";

    if (
      currentMessage.length +
        separator.length +
        formatted.length >
      3500
    ) {
      messages.push(currentMessage);
      currentMessage = formatted;
    } else {
      currentMessage += separator + formatted;
    }
  });

  if (currentMessage) {
    messages.push(currentMessage);
  }

  return messages;
}

async function sendEmailPage(ctx, regionId, offset = 0) {
  const region = regions[regionId];

  if (!region) {
    return ctx.reply("❌ المنطقة غير صحيحة.");
  }

  const companies = getCompaniesByRegion(regionId);
  const page = companies.slice(offset, offset + PAGE_SIZE);

  if (companies.length === 0) {
    return ctx.reply(
      `لا توجد إيميلات مسجلة حاليًا في ${region.name}.`
    );
  }

  if (page.length === 0) {
    return ctx.reply("✅ وصلتِ إلى نهاية القائمة.");
  }

  const from = offset + 1;
  const to = offset + page.length;

  await ctx.reply(
    `${region.emoji} <b>${region.name}</b>\n` +
      `📧 الإيميلات من ${from} إلى ${to}\n` +
      `📊 الإجمالي: ${companies.length}`,
    {
      parse_mode: "HTML"
    }
  );

  const messages = createTelegramMessages(page, from);

  for (const message of messages) {
    await ctx.reply(message);
  }

  const buttons = [];

  if (offset + PAGE_SIZE < companies.length) {
    buttons.push([
      Markup.button.callback(
        "➡️ التالي 50",
        `emails_page:${regionId}:${offset + PAGE_SIZE}`
      )
    ]);
  }

  if (offset > 0) {
    buttons.push([
      Markup.button.callback(
        "⬅️ السابق 50",
        `emails_page:${regionId}:${Math.max(
          0,
          offset - PAGE_SIZE
        )}`
      )
    ]);
  }

  buttons.push([
    Markup.button.callback(
      "📥 تحميل القائمة كاملة",
      `emails_download:${regionId}`
    )
  ]);

  buttons.push([
    Markup.button.callback(
      "🔙 المناطق",
      "company_emails"
    ),
    Markup.button.callback(
      "🏠 الرئيسية",
      "back_to_menu"
    )
  ]);

  return ctx.reply(
    offset + PAGE_SIZE < companies.length
      ? `✅ تم إرسال ${page.length} إيميل.`
      : "✅ تم إرسال آخر دفعة من الإيميلات.",
    Markup.inlineKeyboard(buttons)
  );
}

function createRegionExcel(regionId) {
  const region = regions[regionId];
  const companies = getCompaniesByRegion(regionId);

  const exportRows = companies.map((company) => ({
    Email: company.email,
    City: company.city,
    Company: company.company,
    "المسمى الوظيفي": company.jobTitle
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportRows);

  worksheet["!cols"] = [
    { wch: 35 },
    { wch: 25 },
    { wch: 45 },
    { wch: 45 }
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    region.name.slice(0, 31)
  );

  const safeRegionName = regionId === "all"
    ? "all"
    : regionId;

  const outputDirectory = path.resolve("temp");

  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, {
      recursive: true
    });
  }

  const outputPath = path.join(
    outputDirectory,
    `companies_${safeRegionName}_${Date.now()}.xlsx`
  );

  XLSX.writeFile(workbook, outputPath);

  return {
    outputPath,
    count: companies.length,
    region
  };
}
function normalizeSearchText(text = "") {
  return String(text)
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
}

export function searchCompaniesByJobTitle(query) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const queryWords = normalizedQuery
    .split(" ")
    .filter((word) => word.length > 1);

  const results = readCompanies().filter((company) => {
    const normalizedTitle = normalizeSearchText(
      company.jobTitle
    );

    if (!normalizedTitle) {
      return false;
    }

    // يطابق النص كاملًا أو جميع الكلمات التي كتبها المستخدم
    return (
      normalizedTitle.includes(normalizedQuery) ||
      queryWords.every((word) =>
        normalizedTitle.includes(word)
      )
    );
  });

  // حذف النتائج المكررة
  return results.filter(
    (company, index, self) =>
      index ===
      self.findIndex(
        (item) =>
          item.email.toLowerCase() ===
            company.email.toLowerCase() &&
          item.jobTitle === company.jobTitle
      )
  );
}

export function registerCompanyEmails(bot, sessions) {
    bot.action("company_emails", async (ctx) => {
    await ctx.answerCbQuery();

    return ctx.reply(
      "📧 اختر المنطقة التي تريد إيميلات الشركات فيها:",
      Markup.inlineKeyboard([
        [
  Markup.button.callback(
    "🔍 البحث بالمسمى الوظيفي",
    "emails_search_title"
  )
],

        [
          Markup.button.callback(
            "📍 الرياض",
            "emails_region:riyadh"
          ),
          Markup.button.callback(
            "🌊 الشرقية",
            "emails_region:eastern"
          )
        ],
        [
          Markup.button.callback(
            "🌴 الغربية",
            "emails_region:western"
          ),
          Markup.button.callback(
            "⛰️ الجنوب",
            "emails_region:south"
          )
        ],
        [
          Markup.button.callback(
            "🌾 القصيم",
            "emails_region:qassim"
          ),
          Markup.button.callback(
            "🏔️ الشمال",
            "emails_region:north"
          )
        ],
        [
          Markup.button.callback(
            "📩 كل الإيميلات",
            "emails_region:all"
          )
        ],
        [
          Markup.button.callback(
            "🏠 القائمة الرئيسية",
            "back_to_menu"
          )
        ]
      ])
    );
  });
bot.action("emails_search_title", async (ctx) => {
  await ctx.answerCbQuery();

  sessions.set(ctx.from.id, {
    step: "emails_search_title"
  });

  return ctx.reply(
    `🔍 اكتب المسمى الوظيفي أو جزءًا منه.

أمثلة:
• موارد بشرية
• محاسب
• مهندس
• خدمة عملاء
• قانون

سيتم البحث داخل جميع المسميات الموجودة في ملف Excel.`
  );
});

  bot.action(/^emails_region:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();

    const regionId = ctx.match[1];
    const region = regions[regionId];

    if (!region) {
      return ctx.reply("❌ المنطقة غير صحيحة.");
    }

    const count = getCompaniesByRegion(regionId).length;

    return ctx.reply(
      `${region.emoji} <b>${region.name}</b>\n\n` +
        `📊 عدد الإيميلات المتوفرة: ${count}\n\n` +
        "كيف تريد استلام الإيميلات؟",
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "📧 أول 50",
              `emails_page:${regionId}:0`
            )
          ],
          [
            Markup.button.callback(
              "📥 كامل Excel",
              `emails_download:${regionId}`
            )
          ],
          [
            Markup.button.callback(
              "🔙 المناطق",
              "company_emails"
            )
          ]
        ])
      }
    );
  });

  bot.action(
    /^emails_page:([^:]+):(\d+)$/,
    async (ctx) => {
      await ctx.answerCbQuery();

      const regionId = ctx.match[1];
      const offset = Number(ctx.match[2]);

      return sendEmailPage(ctx, regionId, offset);
    }
  );

  bot.action(
    /^emails_download:(.+)$/,
    async (ctx) => {
      await ctx.answerCbQuery("جاري تجهيز الملف...");

      let outputPath;

      try {
        const result = createRegionExcel(ctx.match[1]);
        outputPath = result.outputPath;

        if (result.count === 0) {
          return ctx.reply(
            `لا توجد بيانات في ${result.region.name}.`
          );
        }

        await ctx.replyWithDocument(
          {
            source: outputPath,
            filename: path.basename(outputPath)
          },
          {
            caption:
              `${result.region.emoji} ${result.region.name}\n` +
              `📊 عدد السجلات: ${result.count}`
          }
        );
      } catch (error) {
        console.error("Company emails error:", error);

        await ctx.reply(
          "❌ حدث خطأ أثناء تجهيز ملف الإيميلات."
        );
      } finally {
        if (outputPath && fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      }
    }
  );
}