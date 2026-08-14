import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const arabicFontPath = path.resolve(
  "node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff2"
);

const arabicBoldFontPath = path.resolve(
  "node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff2"
);

const arabicFontBase64 = fs
  .readFileSync(arabicFontPath)
  .toString("base64");

const arabicBoldFontBase64 = fs
  .readFileSync(arabicBoldFontPath)
  .toString("base64");

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatCVText(text = "", name = "") {
      const lines = String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) =>
  line !== String(name || "").trim()
)
    .filter((line) =>
  line !== session?.cvData?.name
)

    // لا نعرض المدينة نهائيًا
    .filter((line) =>
      !line.startsWith("المدينة:")
    )

    // لا نعرض الحقول الفارغة
    .filter((line) =>
      !line.includes("غير مذكور") &&
      !line.includes("غير متوفر")
    )

.filter((line) =>
  !line.startsWith("رقم الجوال:") &&
  !line.startsWith("الجوال:") &&
  !line.startsWith("الهاتف:") &&
  !line.startsWith("رقم الهاتف:") &&
  !line.startsWith("البريد الإلكتروني:") &&
  !line.startsWith("البريد الالكتروني:")
)

    // لا نعرض كلمات ATS داخل السيرة
    .filter((line) =>
      !line.includes("كلمات مفتاحية لأنظمة ATS") &&
      !line.includes("كلمات مفتاحية ATS")
    );

  const headings = [
    "الملخص المهني",
    "التعليم",
    "الخبرات العملية",
    "الخبرات",
    "الدورات والشهادات",
    "الدورات التدريبية",
    "المهارات",
    "اللغات",
    "العضويات المهنية"
  ];

  return lines
    .map((line) => {
      const value = escapeHtml(line);

      if (
        headings.some(
          (heading) =>
            line === heading ||
            line.startsWith(`${heading}:`)
        )
      ) {
        return `
          <div class="section-title">
            ${value}
          </div>
        `;
      }

      if (
        line.startsWith("-") ||
        line.startsWith("•") ||
        line.startsWith("▪")
      ) {
        const cleaned = escapeHtml(
          line.replace(/^[-•▪]\s*/, "")
        );

        return `
          <div class="bullet">
            <span class="dot">•</span>
            <span>${cleaned}</span>
          </div>
        `;
      }

const isJobTitle = line.startsWith("المسمى:");
const isCompany =
  line.startsWith("اسم الشركة:") ||
  line.startsWith("اسم الجهة:");
const isPeriod = line.startsWith("الفترة:");

if (isJobTitle || isCompany || isPeriod) {
  return `
    <div class="experience-line ${
      isJobTitle ? "job-heading" : ""
    }">
      ${value}
    </div>
  `;
}

if (experienceLabel) {
  const isJobTitle = line.startsWith("المسمى:");

  return `
    <div class="experience-line ${isJobTitle ? "job-heading" : ""}">
      ${value}
    </div>
  `;
}

return `
  <div class="line">
    ${value}
  </div>
`;
    })
    .join("");
}

function createCVHtml(session) {
  const data = session.cvData || {};
  const cvText = session.generatedCV || "";

  const name =
    data.name ||
    "السيرة الذاتية";


  const phone = data.phone || "";
  const email = data.email || "";

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">

<style>
@font-face {
  font-family: "SirAIArabic";
  src: url(data:font/woff2;base64,${arabicFontBase64}) format("woff2");
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: "SirAIArabic";
  src: url(data:font/woff2;base64,${arabicBoldFontBase64}) format("woff2");
  font-weight: 700;
  font-style: normal;
}
@page {
  size: A4;
  margin: 14mm 16mm;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  direction: rtl;
font-family: "SirAIArabic", sans-serif;
  color: #1f2933;
  background: #ffffff;
  font-size: 11.5px;
  line-height: 1.7;
}

.header {
  text-align: right;
  border-bottom: 1px solid #222;
  padding-bottom: 10px;
  margin-bottom: 14px;
}

.name {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 6px;
  color: #111;
}

.contact {
  font-size: 10.5px;
  color: #333;
  direction: rtl;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.contact span {
  display: inline-block;
  margin-left: 0;
}

.content {
  width: 100%;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  color: #111;
  margin-top: 12px;
  margin-bottom: 5px;
  padding-bottom: 2px;
  border-bottom: 1px solid #222;
  page-break-after: avoid;
}

.line {
  font-size: 11px;
  margin-bottom: 2px;
  text-align: right;
  line-height: 1.65;
}
.experience-line {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 1px;
  text-align: right;
  line-height: 1.55;
  page-break-after: avoid;
}
.job-heading {
  margin-top: 8px;
  font-size: 11.5px;
  font-weight: 700;
}
  .bullet {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 5px;
  margin-bottom: 1px;
  font-size: 10.8px;
  line-height: 1.6;
  page-break-inside: avoid;
}

.dot {
  font-size: 14px;
  font-weight: bold;
  line-height: 1.4;
}

.space {
  height: 5px;
}

.footer {
  position: fixed;
  bottom: 4mm;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 8px;
  color: #999;
}

</style>
</head>

<body>

<div class="header">

  <div class="name">
    ${escapeHtml(name)}
  </div>

  <div class="contact">
    ${
      phone
        ? `<span>${escapeHtml(phone)}</span>`
        : ""
    }

    ${
      email
        ? `<span>| ${escapeHtml(email)}</span>`
        : ""
    }
  </div>

</div>

    ${
      phone
        ? `<span>📱 ${escapeHtml(phone)}</span>`
        : ""
    }

    ${
      email
        ? `<span>✉ ${escapeHtml(email)}</span>`
        : ""
    }


  </div>

</div>

<div class="content">
${formatCVText(cvText, name)}
</div>

</body>
</html>
`;
}

export function registerCV(bot, sessions) {

  bot.action(
    "create_cv_pdf",
    async (ctx) => {

      await ctx.answerCbQuery();

      const userId = ctx.from.id;
      const session =
        sessions.get(userId);

      if (!session?.generatedCV) {
        return ctx.reply(
          "❌ لا توجد سيرة ذاتية جاهزة للتحويل إلى PDF."
        );
      }

      const loading =
        await ctx.reply(
          "⏳ جاري تجهيز ملف PDF الاحترافي..."
        );

      let browser;
      let pdfPath;

      try {

        const tempDir =
          path.resolve("temp");

        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(
            tempDir,
            {
              recursive: true
            }
          );
        }

        pdfPath = path.join(
          tempDir,
          `Sir_AI_CV_${userId}_${Date.now()}.pdf`
        );

        const html =
          createCVHtml(session);

        browser =
          await puppeteer.launch({
            headless: true,
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox"
            ]
          });

        const page =
          await browser.newPage();

await page.setContent(
  html,
  {
    waitUntil: "networkidle0"
  }
);

await page.evaluate(async () => {
  await document.fonts.ready;
});

await page.pdf({
              path: pdfPath,
          format: "A4",
          printBackground: true,
          margin: {
            top: "14mm",
            bottom: "14mm",
            left: "14mm",
            right: "14mm"
          }
        });

        try {
          await ctx.telegram.deleteMessage(
            ctx.chat.id,
            loading.message_id
          );
        } catch {}

        await ctx.replyWithDocument(
          {
            source: pdfPath,
            filename:
              `${session.cvData?.name || "CV"} - Sir AI.pdf`
          },
          {
            caption:
              "✅ تم إنشاء سيرتك الذاتية بصيغة PDF."
          }
        );

      } catch (error) {

        console.error(
          "❌ PDF generation error:",
          error
        );

        try {
          await ctx.telegram.deleteMessage(
            ctx.chat.id,
            loading.message_id
          );
        } catch {}

await ctx.reply(
  `❌ PDF ERROR TEST

${error?.message || String(error)}`
);
      } finally {

        if (browser) {
          await browser.close();
        }

        if (
          pdfPath &&
          fs.existsSync(pdfPath)
        ) {
          try {
            fs.unlinkSync(pdfPath);
          } catch {}
        }
      }
    }
  );
}