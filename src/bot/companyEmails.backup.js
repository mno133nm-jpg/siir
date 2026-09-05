import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { Markup } from "telegraf";
import { db, save } from "../services/database.js";

const EXCEL_PATH = path.resolve("companies.xlsx");
const PAGE_SIZE = 50;

const ACCESS_CODES = {
  SIR: {
    hours: 5,
    label: "5 ط³ط§ط¹ط§طھ",
    oneTime: true
  },

  TRIAL5: {
    hours: 5,
    label: "5 ط³ط§ط¹ط§طھ",
    oneTime: true
  },

  FREETHAMER: {
    months: 6,
    label: "6 ط´ظ‡ظˆط±",
    oneTime: true
  },

  SIRFREE: {
    days: 60,
    label: "60 ظٹظˆظ…",
    oneTime: true
  },

  TIKTOK: {
    days: 30,
    label: "30 ظٹظˆظ…",
    oneTime: true
  },

  VIP2026: {
    days: 90,
    label: "90 ظٹظˆظ…",
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

  // ظ…ظ†ط¹ ط§ط³طھط®ط¯ط§ظ… ظ†ظپط³ ط§ظ„ظƒظˆط¯ ط£ظƒط«ط± ظ…ظ† ظ…ط±ط©
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
  const parts = [`${number}. ًںڈ¢ ${company.company || "ط´ط±ظƒط© ط؛ظٹط± ظ…ط­ط¯ط¯ط©"}`];

  if (company.email) {
    parts.push(`ًں“§ ${company.email}`);
  }

  if (company.city) {
    parts.push(`ًں“چ ${company.city}`);
  }

  if (company.jobTitle) {
    parts.push(`ًں’¼ ${company.jobTitle}`);
  }

  return parts.join("\n");
}

/**
 * ظٹظ‚ط³ظ… ط§ظ„ظ‚ط§ط¦ظ…ط© ط¥ظ„ظ‰ ط±ط³ط§ط¦ظ„ ظ„ط§ طھطھط¬ط§ظˆط² ط­ط¯ طھظٹظ„ظٹط¬ط±ط§ظ….
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
      ? "\n\nâ”پâ”پâ”پâ”پâ”پâ”پâ”پâ”پâ”پâ”پâ”پâ”پâ”پâ”پ\n\n"
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
      "â‌Œ ظ„ط§ طھظˆط¬ط¯ ط´ط±ظƒط§طھ ظ…ط³ط¬ظ„ط©."
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
        "â‍،ï¸ڈ ط§ظ„ط´ط±ظƒط§طھ ط§ظ„طھط§ظ„ظٹط©",
        `big_companies_page:${offset + pageSize}`
      )
    ]);
  }

  if (offset > 0) {
    buttons.push([
      Markup.button.callback(
        "â¬…ï¸ڈ ط§ظ„ط´ط±ظƒط§طھ ط§ظ„ط³ط§ط¨ظ‚ط©",
        `big_companies_page:${Math.max(
          0,
          offset - pageSize
        )}`
      )
    ]);
  }

  buttons.push([
    Markup.button.callback(
      "ًں”™ ط±ط¬ظˆط¹",
      "company_emails"
    )
  ]);

  return ctx.reply(
    `ًںڈ¢ ط§ظ„ط´ط±ظƒط§طھ ط§ظ„ظ…ط³ط¬ظ„ط©

ًں“ٹ ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ: ${companyNames.length}
ًں“„ ط¹ط±ط¶ ${offset + 1} ط¥ظ„ظ‰ ${
      offset + page.length
    }`,
    Markup.inlineKeyboard(buttons)
  );
}

async function sendEmailPage(ctx, regionId, offset = 0) {
  const region = regions[regionId];

  if (!region) {
    return ctx.reply("â‌Œ ط§ظ„ظ…ظ†ط·ظ‚ط© ط؛ظٹط± طµط­ظٹط­ط©.");
  }

  const companies = getCompaniesByRegion(regionId);
  const page = companies.slice(offset, offset + PAGE_SIZE);

  if (companies.length === 0) {
    return ctx.reply(
      `ظ„ط§ طھظˆط¬ط¯ ط¥ظٹظ…ظٹظ„ط§طھ ظ…ط³ط¬ظ„ط© ط­ط§ظ„ظٹظ‹ط§ ظپظٹ ${region.name}.`
    );
  }

  if (page.length === 0) {
    return ctx.reply("âœ… ظˆطµظ„طھظگ ط¥ظ„ظ‰ ظ†ظ‡ط§ظٹط© ط§ظ„ظ‚ط§ط¦ظ…ط©.");
  }

  const from = offset + 1;
  const to = offset + page.length;

  await ctx.reply(
    `${region.emoji} <b>${region.name}</b>\n` +
      `ًں“§ ط§ظ„ط¥ظٹظ…ظٹظ„ط§طھ ظ…ظ† ${from} ط¥ظ„ظ‰ ${to}\n` +
      `ًں“ٹ ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ: ${companies.length}`,
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
        "â‍،ï¸ڈ ط§ظ„طھط§ظ„ظٹ 50",
        `emails_page:${regionId}:${offset + PAGE_SIZE}`
      )
    ]);
  }

  if (offset > 0) {
    buttons.push([
      Markup.button.callback(
        "â¬…ï¸ڈ ط§ظ„ط³ط§ط¨ظ‚ 50",
        `emails_page:${regionId}:${Math.max(
          0,
          offset - PAGE_SIZE
        )}`
      )
    ]);
  }

  buttons.push([
    Markup.button.callback(
      "ًں“¥ طھط­ظ…ظٹظ„ ط§ظ„ظ‚ط§ط¦ظ…ط© ظƒط§ظ…ظ„ط©",
      `emails_download:${regionId}`
    )
  ]);

  buttons.push([
    Markup.button.callback(
      "ًں”™ ط§ظ„ظ…ظ†ط§ط·ظ‚",
      "company_emails"
    ),
    Markup.button.callback(
      "ًںڈ  ط§ظ„ط±ط¦ظٹط³ظٹط©",
      "back_to_menu"
    )
  ]);

  return ctx.reply(
    offset + PAGE_SIZE < companies.length
      ? `âœ… طھظ… ط¥ط±ط³ط§ظ„ ${page.length} ط¥ظٹظ…ظٹظ„.`
      : "âœ… طھظ… ط¥ط±ط³ط§ظ„ ط¢ط®ط± ط¯ظپط¹ط© ظ…ظ† ط§ظ„ط¥ظٹظ…ظٹظ„ط§طھ.",
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
    "ط§ظ„ظ…ط³ظ…ظ‰ ط§ظ„ظˆط¸ظٹظپظٹ": company.jobTitle
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
    .replace(/[ط£ط¥ط¢]/g, "ط§")
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

    // ظٹط·ط§ط¨ظ‚ ط§ظ„ظ†طµ ظƒط§ظ…ظ„ظ‹ط§ ط£ظˆ ط¬ظ…ظٹط¹ ط§ظ„ظƒظ„ظ…ط§طھ ط§ظ„طھظٹ ظƒطھط¨ظ‡ط§ ط§ظ„ظ…ط³طھط®ط¯ظ…
    return (
      normalizedTitle.includes(normalizedQuery) ||
      queryWords.every((word) =>
        normalizedTitle.includes(word)
      )
    );
  });

  // ط­ط°ظپ ط§ظ„ظ†طھط§ط¦ط¬ ط§ظ„ظ…ظƒط±ط±ط©
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
    return ctx.reply("â‌Œ ط§ظ†طھظ‡طھ ط¬ظ„ط³ط© ط§ظ„ط¨ط­ط«.");
  }

  const offset = session.emailSearchOffset || 0;
  const results = session.emailSearchResults;

  const page = results.slice(offset, offset + PAGE_SIZE);

  const messages = createTelegramMessages(
    page,
    offset + 1
  );

  await ctx.reply(
    `ًں”چ ظ†طھط§ط¦ط¬ ط§ظ„ط¨ط­ط« ط¹ظ†: ${session.emailSearchQuery}

ًں“„ ط§ظ„ظ†طھط§ط¦ط¬ ${offset + 1} - ${offset + page.length}
ًں“ٹ ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ظ†طھط§ط¦ط¬: ${results.length}`
  );

  for (const message of messages) {
    await ctx.reply(message);
  }

  const keyboard = [];

  if (offset + PAGE_SIZE < results.length) {
    keyboard.push([
      Markup.button.callback(
        `ًں“© ط¹ط±ط¶ ${Math.min(
          PAGE_SIZE,
          results.length - (offset + PAGE_SIZE)
        )} ظ†طھظٹط¬ط© ط§ظ„طھط§ظ„ظٹط©`,
        "emails_search_next"
      )
    ]);
  }

  if (offset > 0) {
    keyboard.push([
      Markup.button.callback(
        "â¬…ï¸ڈ ط§ظ„ظ†طھط§ط¦ط¬ ط§ظ„ط³ط§ط¨ظ‚ط©",
        "emails_search_previous"
      )
    ]);
  }

  keyboard.push([
    Markup.button.callback(
      "ًں”چ ط¨ط­ط« ط¬ط¯ظٹط¯",
      "emails_search_title"
    )
  ]);

  return ctx.reply(
    "ط§ط®طھط±:",
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
    title: "Sir AI - ط§ط´طھط±ط§ظƒ ط´ظ‡ط±",
    description: "ظˆطµظˆظ„ ظƒط§ظ…ظ„ ظ„ط¥ظٹظ…ظٹظ„ط§طھ ط§ظ„ط´ط±ظƒط§طھ ظ„ظ…ط¯ط© 30 ظٹظˆظ…",
    payload: `email_subscription_30:${ctx.from.id}`,
    currency: "XTR",
    prices: [
      {
        label: "ط§ط´طھط±ط§ظƒ ط´ظ‡ط±",
        amount: 250
      }
    ]
  });
});

bot.action("email_sub_60", async (ctx) => {
  await ctx.answerCbQuery();

  return ctx.replyWithInvoice({
    title: "Sir AI - ط§ط´طھط±ط§ظƒ ط´ظ‡ط±ظٹظ†",
    description: "ظˆطµظˆظ„ ظƒط§ظ…ظ„ ظ„ط¥ظٹظ…ظٹظ„ط§طھ ط§ظ„ط´ط±ظƒط§طھ ظ„ظ…ط¯ط© 60 ظٹظˆظ…",
    payload: `email_subscription_60:${ctx.from.id}`,
    currency: "XTR",
    prices: [
      {
        label: "ط§ط´طھط±ط§ظƒ ط´ظ‡ط±ظٹظ†",
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
    "ًںژںï¸ڈ ط£ط±ط³ظ„ ظƒظˆط¯ ط§ظ„ط¯ط®ظˆظ„:"
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
    `âœ… طھظ… طھظپط¹ظٹظ„ ط§ط´طھط±ط§ظƒظƒ ط¨ظ†ط¬ط§ط­

â­گ طھظ… ط§ظ„ط¯ظپط¹: ${payment.total_amount} ظ†ط¬ظ…ط©
âڈ³ ظ…ط¯ط© ط§ظ„ط§ط´طھط±ط§ظƒ: ${days} ظٹظˆظ…
ًں“… ظٹظ†طھظ‡ظٹ ط§ظ„ط§ط´طھط±ط§ظƒ: ${expiresAt.toLocaleDateString("ar-SA")}

ًں“§ طھظ… ظپطھط­ ط¥ظٹظ…ظٹظ„ط§طھ ط§ظ„ط´ط±ظƒط§طھ ظ„ظƒ.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "ًں“§ ظپطھط­ ط¥ظٹظ…ظٹظ„ط§طھ ط§ظ„ط´ط±ظƒط§طھ",
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
      `ًں”گ ط§ط®طھط± ط·ط±ظٹظ‚ط© ط§ظ„ط¯ط®ظˆظ„ ط¥ظ„ظ‰ ط¥ظٹظ…ظٹظ„ط§طھ ط§ظ„ط´ط±ظƒط§طھ:

â­گ ط´ظ‡ط± ظˆط§ط­ط¯ â€” 250 ظ†ط¬ظ…ط©
ًں”¥ ط´ظ‡ط±ط§ظ† â€” 350 ظ†ط¬ظ…ط©
ًںژںï¸ڈ ظ„ط¯ظٹ ظƒظˆط¯ ط¯ط®ظˆظ„`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "â­گ ط´ظ‡ط± â€” 250",
            "email_sub_30"
          )
        ],
        [
          Markup.button.callback(
            "ًں”¥ ط´ظ‡ط±ط§ظ† â€” 350",
            "email_sub_60"
          )
        ],
        [
          Markup.button.callback(
            "ًںژںï¸ڈ ظ„ط¯ظٹ ظƒظˆط¯ ط¯ط®ظˆظ„",
            "email_access_code"
          )
        ],
        [
          Markup.button.callback(
            "ًںڈ  ط§ظ„ط±ط¦ظٹط³ظٹط©",
            "back_to_menu"
          )
        ]
      ])
    );
  }

  return ctx.reply(
    "ًں“§ ط§ط®طھط± ط§ظ„ظ…ظ†ط·ظ‚ط© ط§ظ„طھظٹ طھط±ظٹط¯ ط¥ظٹظ…ظٹظ„ط§طھ ط§ظ„ط´ط±ظƒط§طھ ظپظٹظ‡ط§:",
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "ًںڈ¢ ط¥ظٹظ…ظٹظ„ط§طھ ط§ظ„ط´ط±ظƒط§طھ ط§ظ„ظƒط¨ظٹط±ط©",
          "emails_region:bigCompanies"
        )
      ],
      [
        Markup.button.callback(
          "ًں”چ ط§ظ„ط¨ط­ط« ط¨ط§ظ„ظ…ط³ظ…ظ‰ ط§ظ„ظˆط¸ظٹظپظٹ",
          "emails_search_title"
        )
      ],
      [
        Markup.button.callback(
          "ًں†• ط§ظ„ط¥ظٹظ…ظٹظ„ط§طھ ط§ظ„ط­ط¯ظٹط«ط©",
          "recent_emails"
        )
      ],
      [
        Markup.button.callback(
          "ًں“چ ط§ظ„ط±ظٹط§ط¶",
          "emails_region:riyadh"
        ),
        Markup.button.callback(
          "ًںŒٹ ط§ظ„ط´ط±ظ‚ظٹط©",
          "emails_region:eastern"
        )
      ],
      [
        Markup.button.callback(
          "ًںŒ´ ط§ظ„ط؛ط±ط¨ظٹط©",
          "emails_region:western"
        ),
        Markup.button.callback(
          "â›°ï¸ڈ ط§ظ„ط¬ظ†ظˆط¨",
          "emails_region:south"
        )
      ],
      [
        Markup.button.callback(
          "ًںŒ¾ ط§ظ„ظ‚طµظٹظ…",
          "emails_region:qassim"
        ),
        Markup.button.callback(
          "ًںڈ”ï¸ڈ ط§ظ„ط´ظ…ط§ظ„",
          "emails_region:north"
        )
      ],
      [
        Markup.button.callback(
          "ًں“© ظƒظ„ ط§ظ„ط¥ظٹظ…ظٹظ„ط§طھ",
          "emails_region:all"
        )
      ],
      [
        Markup.button.callback(
          "ًںڈ  ط§ظ„ظ‚ط§ط¦ظ…ط© ط§ظ„ط±ط¦ظٹط³ظٹط©",
          "back_to_menu"
        )
      ]
    ])
  );
});

  // ط¨ط¹ط¯ ظƒظ„ ظ…ط§ ط³ط¨ظ‚ ظٹط¨ط¯ط£ ظ‡ط°ط§
       
  bot.action("recent_emails", async (ctx) => {
  await ctx.answerCbQuery();

  const results = getRecentCompanies();

  if (!results.length) {
    return ctx.reply(
      "ًں“­ ظ„ط§ طھظˆط¬ط¯ ط¥ظٹظ…ظٹظ„ط§طھ ط­ط¯ظٹط«ط© ط­ط§ظ„ظٹظ‹ط§."
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
    emailSearchQuery: `ط§ظ„ط¥ظٹظ…ظٹظ„ط§طھ ط§ظ„ظ…ط¶ط§ظپط© ط¨طھط§ط±ظٹط® ${latestDate}`
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
      "â‌Œ ط§ظ„ظƒظˆط¯ ط؛ظٹط± طµط­ظٹط­. ط­ط§ظˆظ„ظٹ ظ…ط±ط© ط£ط®ط±ظ‰."
    );
  }

const result = activateEmailAccessByCode(
  ctx.from.id,
  code,
  duration
);

if (result?.error === "TRIAL_ALREADY_USED") {
  return ctx.reply(
    "â‌Œ طھظ… ط§ط³طھط®ط¯ط§ظ… ظƒظˆط¯ ط§ظ„طھط¬ط±ط¨ط© ط§ظ„ظ…ط¬ط§ظ†ظٹط© ظ„ظ‡ط°ط§ ط§ظ„ط­ط³ط§ط¨ ظ…ط³ط¨ظ‚ظ‹ط§."
  );
}

const expiresAt = result.expiresAt;

  sessions.delete(ctx.from.id);

  return ctx.reply(
    `âœ… طھظ… طھظپط¹ظٹظ„ ط§ظ„ط¯ط®ظˆظ„ ط§ظ„ظ…ط¬ط§ظ†ظٹ

ًںژںï¸ڈ ط§ظ„ظƒظˆط¯: ${code}
âڈ³ ط§ظ„ظ…ط¯ط©: ${duration.label}
ًں“… ظٹظ†طھظ‡ظٹ: ${expiresAt.toLocaleDateString("ar-SA")}

ًں“§ طھظ… ظپطھط­ ط¥ظٹظ…ظٹظ„ط§طھ ط§ظ„ط´ط±ظƒط§طھ ظ„ظƒ.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "ًں“§ ظپطھط­ ط¥ظٹظ…ظٹظ„ط§طھ ط§ظ„ط´ط±ظƒط§طھ",
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
        "â‌Œ ظ„ظ… ظٹطھظ… ط§ظ„ط¹ط«ظˆط± ط¹ظ„ظ‰ ط§ظ„ط´ط±ظƒط©."
      );
    }

    const results = readCompanies().filter(
      (item) =>
        item.company.trim() === companyName
    );

    if (!results.length) {
      return ctx.reply(
        "â‌Œ ظ„ط§ طھظˆط¬ط¯ ط¨ظٹط§ظ†ط§طھ ظ„ظ‡ط°ظ‡ ط§ظ„ط´ط±ظƒط©."
      );
    }

    let text = `ًںڈ¢ ${companyName}\n\n`;

    results.forEach((item, index) => {
      text += `${index + 1}.\n`;

      if (item.email) {
        text += `ًں“§ ${item.email}\n`;
      }

      if (item.city) {
        text += `ًں“چ ${item.city}\n`;
      }

      if (item.jobTitle) {
        text += `ًں’¼ ${item.jobTitle}\n`;
      }

      text += "\n";
    });

    return ctx.reply(
      text.slice(0, 3900),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "ًں”™ ظƒظ„ ط§ظ„ط´ط±ظƒط§طھ",
            "big_companies"
          )
        ],
        [
  Markup.button.callback(
    "ًں†• ط§ظ„ط¥ظٹظ…ظٹظ„ط§طھ ط§ظ„ط­ط¯ظٹط«ط©",
    "recent_emails"
  )
],
        [
          Markup.button.callback(
            "ًںڈ  ط§ظ„ط±ط¦ظٹط³ظٹط©",
            "back_to_menu"
          )
        ]
      ])
    );
  }
);

  bot.action("big_companies", async (ctx) => {
  await ctx.answerCbQuery();

  // ط¹ط±ط¶ ظ‚ط§ط¦ظ…ط© ط§ظ„ط´ط±ظƒط§طھ ط§ظ„ظƒط¨ظٹط±ط©
});

  bot.action("emails_search_next", async (ctx) => {
  await ctx.answerCbQuery();

  const session = sessions.get(ctx.from.id);

  if (!session?.emailSearchResults) {
    return ctx.reply("â‌Œ ط§ظ†طھظ‡طھ ط¬ظ„ط³ط© ط§ظ„ط¨ط­ط«. ط§ط¨ط¯ط¦ظٹ ط¨ط­ط«ظ‹ط§ ط¬ط¯ظٹط¯ظ‹ط§.");
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
    return ctx.reply("â‌Œ ط§ظ†طھظ‡طھ ط¬ظ„ط³ط© ط§ظ„ط¨ط­ط«. ط§ط¨ط¯ط¦ظٹ ط¨ط­ط«ظ‹ط§ ط¬ط¯ظٹط¯ظ‹ط§.");
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
    `ًں”چ ط§ظƒطھط¨ ط§ظ„ظ…ط³ظ…ظ‰ ط§ظ„ظˆط¸ظٹظپظٹ ط£ظˆ ط¬ط²ط،ظ‹ط§ ظ…ظ†ظ‡.

ط£ظ…ط«ظ„ط©:
â€¢ ظ…ظˆط§ط±ط¯ ط¨ط´ط±ظٹط©
â€¢ ظ…ط­ط§ط³ط¨
â€¢ ظ…ظ‡ظ†ط¯ط³
â€¢ ط®ط¯ظ…ط© ط¹ظ…ظ„ط§ط،
â€¢ ظ‚ط§ظ†ظˆظ†

ط³ظٹطھظ… ط§ظ„ط¨ط­ط« ط¯ط§ط®ظ„ ط¬ظ…ظٹط¹ ط§ظ„ظ…ط³ظ…ظٹط§طھ ط§ظ„ظ…ظˆط¬ظˆط¯ط© ظپظٹ ظ…ظ„ظپ Excel.`
  );
});

  bot.action(/^emails_region:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();

    const regionId = ctx.match[1];
    const region = regions[regionId];

    if (!region) {
      return ctx.reply("â‌Œ ط§ظ„ظ…ظ†ط·ظ‚ط© ط؛ظٹط± طµط­ظٹط­ط©.");
    }

    const count = getCompaniesByRegion(regionId).length;

    return ctx.reply(
      `${region.emoji} <b>${region.name}</b>\n\n` +
        `ًں“ٹ ط¹ط¯ط¯ ط§ظ„ط¥ظٹظ…ظٹظ„ط§طھ ط§ظ„ظ…طھظˆظپط±ط©: ${count}\n\n` +
        "ظƒظٹظپ طھط±ظٹط¯ ط§ط³طھظ„ط§ظ… ط§ظ„ط¥ظٹظ…ظٹظ„ط§طھطں",
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "ًں“§ ط£ظˆظ„ 50",
              `emails_page:${regionId}:0`
            )
          ],
          [
            Markup.button.callback(
              "ًں“¥ ظƒط§ظ…ظ„ Excel",
              `emails_download:${regionId}`
            )
          ],
          [
            Markup.button.callback(
              "ًں”™ ط§ظ„ظ…ظ†ط§ط·ظ‚",
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
      await ctx.answerCbQuery("ط¬ط§ط±ظٹ طھط¬ظ‡ظٹط² ط§ظ„ظ…ظ„ظپ...");

      let outputPath;

      try {
        const result = createRegionExcel(ctx.match[1]);
        outputPath = result.outputPath;

        if (result.count === 0) {
          return ctx.reply(
            `ظ„ط§ طھظˆط¬ط¯ ط¨ظٹط§ظ†ط§طھ ظپظٹ ${result.region.name}.`
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
              `ًں“ٹ ط¹ط¯ط¯ ط§ظ„ط³ط¬ظ„ط§طھ: ${result.count}`
          }
        );
      } catch (error) {
        console.error("Company emails error:", error);

        await ctx.reply(
          "â‌Œ ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، طھط¬ظ‡ظٹط² ظ…ظ„ظپ ط§ظ„ط¥ظٹظ…ظٹظ„ط§طھ."
        );
      } finally {
        if (outputPath && fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      }
    }
  );
}
