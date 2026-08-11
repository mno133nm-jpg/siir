import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatCVText(text = "") {
  const safeText = escapeHtml(text);

  return safeText
    .split("\n")
    .map((line) => {
      const value = line.trim();

      if (!value) {
        return `<div class="space"></div>`;
      }

      const headings = [
        "معلومات التواصل",
        "الملخص المهني",
        "التعليم",
        "الخبرات العملية",
        "الخبرات",
        "المهارات",
        "الدورات والشهادات",
        "الدورات التدريبية",
        "اللغات",
        "العضويات المهنية"
      ];

      if (
        headings.some(
          (heading) =>
            value === heading ||
            value.startsWith(`${heading}:`)
        )
      ) {
        return `
          <div class="section-title">
            ${value}
          </div>
        `;
      }

      if (
        value.startsWith("-") ||
        value.startsWith("•") ||
        value.startsWith("▪")
      ) {
        const cleaned = value.replace(
          /^[-•▪]\s*/,
          ""
        );

        return `
          <div class="bullet">
            <span class="dot">•</span>
            <span>${cleaned}</span>
          </div>
        `;
      }

      return `<div class="line">${value}</div>`;
    })
    .join("");
}

function createCVHtml(session) {
  const data = session.cvData || {};
  const cvText = session.generatedCV || "";

  const name =
    data.name ||
    "السيرة الذاتية";

  const jobTitle =
    data.jobTitle ||
    data.targetJobTitle ||
    "";

  const phone = data.phone || "";
  const email = data.email || "";

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">

<style>

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
  font-family: Arial, "Tahoma", sans-serif;
  color: #1f2933;
  background: #ffffff;
  font-size: 11.5px;
  line-height: 1.7;
}

.header {
  text-align: right;
  border-bottom: 2px solid #222;
  padding-bottom: 12px;
  margin-bottom: 17px;
}

.name {
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 2px;
  color: #111;
}

.job-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 7px;
  color: #444;
}

.contact {
  font-size: 10.5px;
  color: #444;
  direction: rtl;
}

.contact span {
  display: inline-block;
  margin-left: 12px;
}

.content {
  width: 100%;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  border-bottom: 1px solid #777;
  padding-bottom: 3px;
  margin-top: 15px;
  margin-bottom: 7px;
  color: #111;
  page-break-after: avoid;
}

.line {
  margin-bottom: 3px;
  text-align: right;
}

.bullet {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 7px;
  margin-bottom: 2px;
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

  ${
    jobTitle
      ? `
        <div class="job-title">
          ${escapeHtml(jobTitle)}
        </div>
      `
      : ""
  }

  <div class="contact">

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
  ${formatCVText(cvText)}
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
            waitUntil:
              "networkidle0"
          }
        );

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
          "❌ حدث خطأ أثناء إنشاء ملف PDF."
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