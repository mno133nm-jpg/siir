import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { Markup } from "telegraf";
import { db, save } from "../services/database.js";

const EXCEL_PATH = path.resolve("companies.xlsx");
const PAGE_SIZE = 50;
const ADMIN_IDS = [
  1310982886
];

const ACCESS_CODES = {
  SIR: {
    hours: 5,
    label: "5 ساعات",
    oneTime: true
  },

  TRIAL5: {
    hours: 5,
    label: "5 ساعات",
    oneTime: true
  },

  FREETHAMER: {
    months: 6,
    label: "6 شهور",
    oneTime: true
  },

  SIRFREE: {
    days: 60,
    label: "60 يوم",
    oneTime: true
  },

  TIKTOK: {
    days: 30,
    label: "30 يوم",
    oneTime: true
  },

  VIP2026: {
    days: 90,
    label: "90 يوم",
    oneTime: true
  }
};

function hasEmailAccess(userId) {
  const data = db();
  const user = data.users?.[String(userId)];

  if (!user?.subscriptionExpiresAt) {
    return false;
  }

  const expiresAt = new Date(
    user.subscriptionExpiresAt
  );

  return expiresAt > new Date();
}
function activateEmailAccessByCode(userId, code, duration) {
  const data = db();

  data.users = data.users || {};

  const id = String(userId);

  data.users[id] = data.users[id] || {
    id
  };

  const user = data.users[id];

  user.usedAccessCodes = user.usedAccessCodes || [];

  // منع استخدام نفس الكود أكثر من مرة
  if (
    duration.oneTime &&
    user.usedAccessCodes.includes(code)
  ) {
    return {
      error: "CODE_ALREADY_USED"
    };
  }

  const now = new Date();

  const currentExpiry = user.subscriptionExpiresAt
    ? new Date(user.subscriptionExpiresAt)
    : now;

  const expiresAt =
    currentExpiry > now
      ? new Date(currentExpiry)
      : new Date(now);

  if (duration.hours) {
    expiresAt.setHours(
      expiresAt.getHours() + duration.hours
    );
  }

  if (duration.days) {
    expiresAt.setDate(
      expiresAt.getDate() + duration.days
    );
  }

  if (duration.months) {
    expiresAt.setMonth(
      expiresAt.getMonth() + duration.months
    );
  }

  user.subscriptionActive = true;
  user.subscriptionType = "code";
  user.subscriptionCode = code;
  user.subscriptionExpiresAt =
    expiresAt.toISOString();

  if (duration.oneTime) {
    user.usedAccessCodes.push(code);
  }

  save(data);

  return {
    expiresAt
  };
}
const regions = {
  bigCompanies: {
    name: "الشركات الكبيرة",
    emoji: "🏢",
    keywords: ["شركة كبيرة"]
  },

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

  const rows = XLSX.utils.sheet_to_json(
    worksheet,
    {
      defval: ""
    }
  );

  return rows
    .map((row) => ({
      email: String(
        row.Email || ""
      ).trim(),

      city: String(
        row.City || ""
      ).trim(),

      company: String(
        row.Company || ""
      ).trim(),

      jobTitle: String(
        row["المسمى الوظيفي"] || ""
      ).trim(),

      addedDate: String(
        row["تاريخ الإضافة"] || ""
      ).trim()
    }))
    .filter((row) => row.email);
}

  function getAllCompanyNames() {
  const companies = readCompanies();

  return [
    ...new Set(
      companies
        .map((item) => item.company.trim())
        .filter(Boolean)
    )
  ].sort((a, b) =>
    a.localeCompare(b, "ar")
  );
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
async function sendCompaniesNamesPage(
  ctx,
  offset = 0
) {
  const companyNames = getAllCompanyNames();
  const pageSize = 30;

  const page = companyNames.slice(
    offset,
    offset + pageSize
  );

  if (!page.length) {
    return ctx.reply(
      "❌ لا توجد شركات مسجلة."
    );
  }

  const buttons = page.map(
    (companyName, index) => [
      Markup.button.callback(
        companyName,
        `company_name:${offset + index}`
      )
    ]
  );

  if (offset + pageSize < companyNames.length) {
    buttons.push([
      Markup.button.callback(
        "➡️ الشركات التالية",
        `big_companies_page:${offset + pageSize}`
      )
    ]);
  }

  if (offset > 0) {
    buttons.push([
      Markup.button.callback(
        "⬅️ الشركات السابقة",
        `big_companies_page:${Math.max(
          0,
          offset - pageSize
        )}`
      )
    ]);
  }

  buttons.push([
    Markup.button.callback(
      "🔙 رجوع",
      "company_emails"
    )
  ]);

  return ctx.reply(
    `🏢 الشركات المسجلة

📊 الإجمالي: ${companyNames.length}
📄 عرض ${offset + 1} إلى ${
      offset + page.length
    }`,
    Markup.inlineKeyboard(buttons)
  );
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

let sentMessages = 0;

for (const message of messages) {
  if (
    typeof message !== "string" ||
    !message.trim()
  ) {
    console.log(
      "⚠️ تم تجاهل رسالة إيميلات فارغة."
    );
    continue;
  }

  try {
await ctx.reply(message, {
  protect_content: true
});
    sentMessages++;
  } catch (error) {
    console.error(
      "❌ EMAIL MESSAGE SEND ERROR:",
      error
    );

    await ctx.reply(
      `❌ حدث خطأ أثناء إرسال الإيميلات.

${error?.message || String(error)}`
    );

    break;
  }
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
    .replace(/ط©/g, "ظ‡")
    .replace(/ظ‰/g, "ظٹ")
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
function getRecentCompanies() {
  const companies = readCompanies();

  return companies
    .filter((company) => company.addedDate)
    .sort((a, b) =>
      String(b.addedDate).localeCompare(String(a.addedDate))
    );
}
export function getLatestAddedBatch() {
  const companies = getRecentCompanies();

  if (!companies.length) {
    return null;
  }

  const latestDate = companies[0].addedDate;

  const latestCompanies = companies.filter(
    (company) => company.addedDate === latestDate
  );

  return {
    latestDate,
    count: latestCompanies.length
  };
}
async function sendEmailSearchPage(ctx, sessions) {
  const session = sessions.get(ctx.from.id);

  if (!session?.emailSearchResults?.length) {
    return ctx.reply("❌ انتهت جلسة البحث.");
  }

  const offset = session.emailSearchOffset || 0;
  const results = session.emailSearchResults;

  const page = results.slice(offset, offset + PAGE_SIZE);

  const messages = createTelegramMessages(
    page,
    offset + 1
  );

  await ctx.reply(
    `🔍 نتائج البحث عن: ${session.emailSearchQuery}

📄 النتائج ${offset + 1} - ${offset + page.length}
📊 إجمالي النتائج: ${results.length}`
  );

  for (const message of messages) {
await ctx.reply(message, {
  protect_content: true
});
  }

  const keyboard = [];

  if (offset + PAGE_SIZE < results.length) {
    keyboard.push([
      Markup.button.callback(
        `📩 عرض ${Math.min(
          PAGE_SIZE,
          results.length - (offset + PAGE_SIZE)
        )} نتيجة التالية`,
        "emails_search_next"
      )
    ]);
  }

  if (offset > 0) {
    keyboard.push([
      Markup.button.callback(
        "⬅️ النتائج السابقة",
        "emails_search_previous"
      )
    ]);
  }

  keyboard.push([
    Markup.button.callback(
      "🔍 بحث جديد",
      "emails_search_title"
    )
  ]);

  return ctx.reply(
    "اختر:",
    Markup.inlineKeyboard(keyboard)
  );
}
function activatePaidEmailAccess(userId, days, payment) {
  const data = db();

  data.users = data.users || {};

  const id = String(userId);

  data.users[id] = data.users[id] || {
    id
  };

  const user = data.users[id];
  const now = new Date();

  const currentExpiry = user.subscriptionExpiresAt
    ? new Date(user.subscriptionExpiresAt)
    : now;

  const expiresAt =
    currentExpiry > now
      ? new Date(currentExpiry)
      : new Date(now);

  expiresAt.setDate(
    expiresAt.getDate() + days
  );

  user.subscriptionActive = true;
  user.subscriptionType = "telegram_stars";
  user.subscriptionExpiresAt =
    expiresAt.toISOString();

  user.telegramPaymentChargeId =
    payment.telegram_payment_charge_id;

  user.lastPaymentStars =
    payment.total_amount;

  save(data);

  return expiresAt;
}

export function registerCompanyEmails(bot, sessions) {

bot.on("pre_checkout_query", async (ctx) => {
  try {
    await ctx.answerPreCheckoutQuery(true);
  } catch (error) {
    console.error("Pre-checkout error:", error);
  }
});

bot.action("email_sub_30", async (ctx) => {
  await ctx.answerCbQuery();

  return ctx.replyWithInvoice({
    title: "Sir AI - اشتراك شهر",
    description: "وصول كامل لإيميلات الشركات لمدة 30 يوم",
    payload: `email_subscription_30:${ctx.from.id}`,
    currency: "XTR",
    prices: [
      {
        label: "اشتراك شهر",
        amount: 250
      }
    ]
  });
});

bot.action("email_sub_60", async (ctx) => {
  await ctx.answerCbQuery();

  return ctx.replyWithInvoice({
    title: "Sir AI - اشتراك شهرين",
    description: "وصول كامل لإيميلات الشركات لمدة 60 يوم",
    payload: `email_subscription_60:${ctx.from.id}`,
    currency: "XTR",
    prices: [
      {
        label: "اشتراك شهرين",
        amount: 350
      }
    ]
  });
});

bot.action("email_access_code", async (ctx) => {
  await ctx.answerCbQuery();

  const session =
    sessions.get(ctx.from.id) || {};

  session.step = "waiting_email_access_code";

  sessions.set(ctx.from.id, session);

  return ctx.reply(
    "🎟️ أرسل كود الدخول:"
  );
});

bot.on("successful_payment", async (ctx) => {
  const payment =
    ctx.message.successful_payment;

  if (!payment) {
    return;
  }

  const payload =
    payment.invoice_payload || "";

  let days = 0;

  if (
    payload.startsWith(
      "email_subscription_30:"
    )
  ) {
    days = 30;
  }

  if (
    payload.startsWith(
      "email_subscription_60:"
    )
  ) {
    days = 60;
  }

  if (!days) {
    return;
  }

  const expiresAt =
    activatePaidEmailAccess(
      ctx.from.id,
      days,
      payment
    );

  return ctx.reply(
    `✅ تم تفعيل اشتراكك بنجاح

⭐ تم الدفع: ${payment.total_amount} نجمة
⏳ مدة الاشتراك: ${days} يوم
📅 ينتهي الاشتراك: ${expiresAt.toLocaleDateString("ar-SA")}

📧 تم فتح إيميلات الشركات لك.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "📧 فتح إيميلات الشركات",
          "company_emails"
        )
      ]
    ])
  );
});



bot.action("company_emails", async (ctx) => {
  await ctx.answerCbQuery();

  if (!hasEmailAccess(ctx.from.id)) {
    return ctx.reply(
      `🔐 اختر طريقة الدخول إلى إيميلات الشركات:

⭐ شهر واحد — 250 نجمة
🔥 شهران — 350 نجمة
🎟️ لدي كود دخول`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "⭐ شهر — 250",
            "email_sub_30"
          )
        ],
        [
          Markup.button.callback(
            "🔥 شهران — 350",
            "email_sub_60"
          )
        ],
        [
          Markup.button.callback(
            "🎟️ لدي كود دخول",
            "email_access_code"
          )
        ],
        [
          Markup.button.callback(
            "🏠 الرئيسية",
            "back_to_menu"
          )
        ]
      ])
    );
  }

  return ctx.reply(
    "📧 اختر المنطقة التي تريد إيميلات الشركات فيها:",
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "🏢 إيميلات الشركات الكبيرة",
          "emails_region:bigCompanies"
        )
      ],
      [
        Markup.button.callback(
          "🔍 البحث بالمسمى الوظيفي",
          "emails_search_title"
        )
      ],
      [
        Markup.button.callback(
          "🆕 الإيميلات الحديثة",
          "recent_emails"
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

  // بعد كل ما سبق يبدأ هذا
       
  bot.action("recent_emails", async (ctx) => {
  await ctx.answerCbQuery();

  const results = getRecentCompanies();

  if (!results.length) {
    return ctx.reply(
      "📭 لا توجد إيميلات حديثة حاليًا."
    );
  }

  const latestDate = results[0].addedDate;

  const latestResults = results.filter(
    (company) => company.addedDate === latestDate
  );

  sessions.set(ctx.from.id, {
    step: "emails_search_results",
    emailSearchResults: latestResults,
    emailSearchOffset: 0,
    emailSearchQuery: `الإيميلات المضافة بتاريخ ${latestDate}`
  });
if (session?.step === "waiting_email_access_code") {
  const code = ctx.message.text
    .trim()
    .toUpperCase();
console.log("CODE RECEIVED:", JSON.stringify(code));
console.log("AVAILABLE CODES:", Object.keys(ACCESS_CODES));

const duration = ACCESS_CODES[code];

if (!duration) {
      return ctx.reply(
      "❌ الكود غير صحيح. حاولي مرة أخرى."
    );
  }

const result = activateEmailAccessByCode(
  ctx.from.id,
  code,
  duration
);

if (result?.error === "TRIAL_ALREADY_USED") {
  return ctx.reply(
    "❌ تم استخدام كود التجربة المجانية لهذا الحساب مسبقًا."
  );
}

const expiresAt = result.expiresAt;

  sessions.delete(ctx.from.id);

  return ctx.reply(
    `✅ تم تفعيل الدخول المجاني

🎟️ الكود: ${code}
⏳ المدة: ${duration.label}
📅 ينتهي: ${expiresAt.toLocaleDateString("ar-SA")}

📧 تم فتح إيميلات الشركات لك.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "📧 فتح إيميلات الشركات",
          "company_emails"
        )
      ]
    ])
  );
}

  return sendEmailSearchPage(ctx, sessions);
});

  bot.action(
  "big_companies",
  async (ctx) => {
    await ctx.answerCbQuery();

    return sendCompaniesNamesPage(ctx, 0);
  }
);

bot.action(
  /^big_companies_page:(\d+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const offset = Number(ctx.match[1]);

    return sendCompaniesNamesPage(
      ctx,
      offset
    );
  }
);
bot.action(
  /^company_name:(\d+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const companyNames =
      getAllCompanyNames();

    const companyIndex =
      Number(ctx.match[1]);

    const companyName =
      companyNames[companyIndex];

    if (!companyName) {
      return ctx.reply(
        "❌ لم يتم العثور على الشركة."
      );
    }

    const results = readCompanies().filter(
      (item) =>
        item.company.trim() === companyName
    );

    if (!results.length) {
      return ctx.reply(
        "❌ لا توجد بيانات لهذه الشركة."
      );
    }

    let text = `🏢 ${companyName}\n\n`;

    results.forEach((item, index) => {
      text += `${index + 1}.\n`;

      if (item.email) {
        text += `📧 ${item.email}\n`;
      }

      if (item.city) {
        text += `📍 ${item.city}\n`;
      }

      if (item.jobTitle) {
        text += `💼 ${item.jobTitle}\n`;
      }

      text += "\n";
    });

    return ctx.reply(
      text.slice(0, 3900),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "🔙 كل الشركات",
            "big_companies"
          )
        ],
        [
  Markup.button.callback(
    "🆕 الإيميلات الحديثة",
    "recent_emails"
  )
],
        [
          Markup.button.callback(
            "🏠 الرئيسية",
            "back_to_menu"
          )
        ]
      ])
    );
  }
);

  bot.action("big_companies", async (ctx) => {
  await ctx.answerCbQuery();

  // عرض قائمة الشركات الكبيرة
});

  bot.action("emails_search_next", async (ctx) => {
  await ctx.answerCbQuery();

  const session = sessions.get(ctx.from.id);

  if (!session?.emailSearchResults) {
    return ctx.reply("❌ انتهت جلسة البحث. ابدئي بحثًا جديدًا.");
  }

  session.emailSearchOffset =
    (session.emailSearchOffset || 0) + 50;

  sessions.set(ctx.from.id, session);

  return sendEmailSearchPage(ctx, sessions);
});

bot.action("emails_search_previous", async (ctx) => {
  await ctx.answerCbQuery();

  const session = sessions.get(ctx.from.id);

  if (!session?.emailSearchResults) {
    return ctx.reply("❌ انتهت جلسة البحث. ابدئي بحثًا جديدًا.");
  }

  session.emailSearchOffset = Math.max(
    0,
    (session.emailSearchOffset || 0) - 50
  );

  sessions.set(ctx.from.id, session);

  return sendEmailSearchPage(ctx, sessions);
});
bot.on("text", async (ctx, next) => {

  const session = sessions.get(ctx.from.id);

  // =========================
  // إدخال كود الاشتراك
  // =========================
  if (session?.step === "waiting_email_access_code") {
    const code = ctx.message.text
      .trim()
      .toUpperCase();

    const duration = ACCESS_CODES[code];

    if (!duration) {
      return ctx.reply(
        "❌ الكود غير صحيح. حاول مرة أخرى."
      );
    }

    const result = activateEmailAccessByCode(
      ctx.from.id,
      code,
      duration
    );

    if (result?.error === "CODE_ALREADY_USED") {
      return ctx.reply(
        "❌ سبق استخدام هذا الكود على هذا الحساب."
      );
    }

    const expiresAt = result.expiresAt;

    sessions.delete(ctx.from.id);

    return ctx.reply(
      `✅ تم تفعيل الدخول المجاني

🎟️ الكود: ${code}
⏳ المدة: ${duration.label}
📅 ينتهي: ${expiresAt.toLocaleString("ar-SA")}

📧 تم فتح إيميلات الشركات لك.`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "📧 فتح إيميلات الشركات",
            "company_emails"
          )
        ]
      ])
    );
  }

  // =========================
  // البحث بالمسمى الوظيفي
  // =========================
  if (session?.step !== "emails_search_title") {
    return next();
  }

  const query = ctx.message.text.trim();

  if (query.length < 2) {
    return ctx.reply(
      "❌ اكتب حرفين على الأقل من المسمى الوظيفي."
    );
  }

  const results =
    searchCompaniesByJobTitle(query);

  if (!results.length) {
    return ctx.reply(
      `❌ لم أجد نتائج تحتوي على: ${query}

جرّب كتابة جزء أقصر من المسمى، مثل:
موارد بشرية
محاسب
مهندس
خدمة عملاء`
    );
  }

  sessions.set(ctx.from.id, {
    step: "emails_search_results",
    emailSearchResults: results,
    emailSearchOffset: 0,
    emailSearchQuery: query
  });

  return sendEmailSearchPage(
    ctx,
    sessions
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
