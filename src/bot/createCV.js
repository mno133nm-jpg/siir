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
function removeDuplicateCVContent(text = "") {
  const lines = String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const normalize = (value = "") =>
    String(value)
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[：:]/g, "");

  const sectionNames = [
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

  const isSection = (line) => {
    const value = normalize(line);

    return sectionNames.some(
      (section) => value === normalize(section)
    );
  };

  const sectionPositions = [];

  lines.forEach((line, index) => {
    if (isSection(line)) {
      sectionPositions.push({
        index,
        name: normalize(line)
      });
    }
  });

  // أقل من قسمين: ما فيه شيء واضح ننظفه
  if (sectionPositions.length < 2) {
    return lines.join("\n");
  }

  const seenSections = new Set();

  for (const section of sectionPositions) {
    // أول مرة يظهر العنوان نخليه
    if (!seenSections.has(section.name)) {
      seenSections.add(section.name);
      continue;
    }

    // إذا بدأ عنوان قسم يتكرر، نعتبر أن النسخة الثانية بدأت هنا
    return lines
      .slice(0, section.index)
      .join("\n");
  }

  return lines.join("\n");
}

function formatCVText(text = "", name = "", phone = "", email = "", jobTitle = "") {
  const clean = (value = "") =>
    String(value)
      .trim()
      .replace(/\s+/g, " ");

  const cleanName = clean(name);
  const cleanPhone = clean(phone);
  const cleanEmail = clean(email).toLowerCase();
  const cleanJobTitle = clean(jobTitle);

  const lines = String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

    // حذف الاسم إذا تكرر داخل جسم السيرة
    .filter((line) => clean(line) !== cleanName)

    // حذف المسمى الوظيفي المستهدف إذا ظهر كسطر مستقل
    .filter((line) => clean(line) !== cleanJobTitle)

    // حذف عناوين المعلومات الشخصية والتواصل
    .filter((line) => {
      const value = clean(line);

      return ![
        "معلومات التواصل",
        "المعلومات الشخصية",
        "البيانات الشخصية",
        "معلومات شخصية",
        "بيانات التواصل"
      ].includes(value);
    })

    // حذف الجوال والإيميل المكررين حتى لو جاءا بدون عنوان
.filter((line) => {
  const value = clean(line);
  const lower = value.toLowerCase();

  // حذف الجوال المخزن حتى لو ظهر بنفس الصيغة
  if (cleanPhone && value.includes(cleanPhone)) {
    return false;
  }

  // حذف البريد المخزن
  if (cleanEmail && lower.includes(cleanEmail)) {
    return false;
  }

  // حذف أي إيميل يظهر داخل جسم السيرة
  const emailPattern =
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

  if (emailPattern.test(value)) {
    return false;
  }

  // حذف أرقام الجوال السعودية بمختلف الصيغ
  const phonePattern =
    /(?:\+?966[\s-]?)?0?5\d(?:[\s-]?\d){7}/;

  if (phonePattern.test(value)) {
    return false;
  }

  return true;
})
.filter((line) => {
  const value = clean(line);

  return !/^[□�|•·\-\s]+$/.test(value);
})

    // حذف حقول التواصل والمدينة والعنوان
    .filter((line) => {
      const value = clean(line);

      return (
        !value.startsWith("رقم الجوال:") &&
        !value.startsWith("رقم الجوال") &&
        !value.startsWith("الجوال:") &&
        !value.startsWith("الجوال") &&
        !value.startsWith("الهاتف:") &&
        !value.startsWith("الهاتف") &&
        !value.startsWith("رقم الهاتف:") &&
        !value.startsWith("البريد الإلكتروني:") &&
        !value.startsWith("البريد الالكتروني:") &&
        !value.startsWith("الإيميل:") &&
        !value.startsWith("الايميل:") &&
        !value.startsWith("المدينة:") &&
        !value.startsWith("العنوان:")
      );
    })

    // حذف أي سطر عبارة عن مربعات/رموز تالفة فقط
    .filter((line) => {
      const value = clean(line);
      return !/^[□�\s|]+$/.test(value);
    })

    // حذف الحقول غير الموجودة
    .filter(
      (line) =>
        !line.includes("غير مذكور") &&
        !line.includes("غير متوفر")
    )

    // عدم عرض ATS كقسم داخل السيرة
    .filter(
      (line) =>
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
const summaryIndex = lines.findIndex((line) => {
  const value = line.trim();

  return (
    value === "الملخص المهني" ||
    value.startsWith("الملخص المهني:")
  );
});

const contentLines =
  summaryIndex >= 0
    ? lines.slice(summaryIndex)
    : lines;

let insideSkills = false;
let insideLanguages = false;

return contentLines
  .map((line) => {
              const value = escapeHtml(line);
if (line === "المهارات") {
  insideSkills = true;

  return `
    <div class="section-title">
      ${value}
    </div>
    <div class="skills-grid">
  `;
}

if (
  insideSkills &&
  (
    line === "اللغات" ||
    line === "العضويات المهنية" ||
    line === "الدورات والشهادات" ||
    line === "الدورات التدريبية" ||
    line === "التعليم" ||
    line === "الخبرات" ||
    line === "الخبرات العملية"
  )
) {
  insideSkills = false;

  return `
    </div>
    <div class="section-title">
      ${value}
    </div>
  `;
}
if (insideSkills) {
  const cleaned = escapeHtml(
    line.replace(/^[-•▪]\s*/, "")
  );

  return `
    <div class="skill-item">
      ${cleaned}
    </div>
  `;
}
if (line === "اللغات") {
  insideLanguages = true;

  return `
    <div class="section-title">
      ${value}
    </div>
  `;
}

if (insideLanguages) {
  const cleaned = escapeHtml(
    line.replace(/^[-•▪]\s*/, "")
  );

  return `
    <div class="language-item">
      ${cleaned}
    </div>
  `;
}

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

if (line.startsWith("المسمى:")) {
  const text = escapeHtml(
    line.replace("المسمى:", "").trim()
  );

  return `
    <div class="experience-title">
      ${text}
    </div>
  `;
}

if (
  line.startsWith("اسم الشركة:") ||
  line.startsWith("اسم الجهة:")
) {
  const text = escapeHtml(
    line
      .replace("اسم الشركة:", "")
      .replace("اسم الجهة:", "")
      .trim()
  );

  return `
    <div class="experience-company">
      ${text}
    </div>
  `;
}

if (line.startsWith("الفترة:")) {
  const text = escapeHtml(
    line.replace("الفترة:", "").trim()
  );

  return `
    <div class="experience-date">
      ${text}
    </div>
  `;
}
if (
  line.startsWith("المؤهل:") ||
  line.startsWith("التخصص:") ||
  line.startsWith("الجهة التعليمية:") ||
  line.startsWith("الجامعة:") ||
  line.startsWith("الكلية:") ||
  line.startsWith("سنة التخرج:")
) {
  return `
    <div class="education-line">
      ${value}
    </div>
  `;
}

if (
  line.startsWith("الدورة:") ||
  line.startsWith("الشهادة:")
) {
  return `
    <div class="course-line">
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
.join("") + (insideSkills ? "</div>" : "");
}

function createCVHtml(session) {
  const data = session.cvData || {};
const cvText = removeDuplicateCVContent(
  session.generatedCV || ""
);

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
  margin: 12mm 15mm;
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
  font-size: 11px;
  line-height: 1.6;
}

.header {
  text-align: right;
  border-bottom: 1px solid #222;
  padding-bottom: 8px;
  margin-bottom: 10px;
}

.name {
  font-size: 23px;
  font-weight: 700;
  margin-bottom: 4px;
  color: #111;
}

.contact {
  font-size: 10px;
  color: #333;
  direction: rtl;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.section-title {
  font-size: 12.5px;
  font-weight: 700;
  color: #111;
  margin-top: 10px;
  margin-bottom: 4px;
  padding-bottom: 2px;
  border-bottom: 1px solid #444;
  page-break-after: avoid;
}

.line {
  font-size: 10.8px;
  margin-bottom: 1px;
  text-align: right;
  line-height: 1.55;
}

.experience-line {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 1px;
  text-align: right;
  line-height: 1.55;
  page-break-after: avoid;
}
  .experience-title {
  font-size: 11.8px;
  font-weight: 700;
  color: #111;
  margin-top: 9px;
  margin-bottom: 0;
}

.experience-company {
  font-size: 11px;
  font-weight: 600;
  color: #333;
  margin-bottom: 0;
}

.experience-date {
  font-size: 10px;
  color: #666;
  margin-bottom: 4px;
}
  .education-line {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 2px;
  text-align: right;
  line-height: 1.55;
}

.course-line {
  font-size: 10.8px;
  margin-bottom: 2px;
  text-align: right;
  line-height: 1.55;
}
  .skills-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 18px;
  row-gap: 3px;
  margin-top: 4px;
  margin-bottom: 6px;
}

.skill-item {
  font-size: 10.8px;
  line-height: 1.5;
  position: relative;
  padding-right: 10px;
}
.language-item {
  font-size: 10.8px;
  line-height: 1.6;
  margin-bottom: 2px;
  padding-right: 10px;
  position: relative;
}

.language-item::before {
  content: "•";
  position: absolute;
  right: 0;
}
.skill-item::before {
  content: "•";
  position: absolute;
  right: 0;
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


<div class="content">
${formatCVText(
  cvText,
  name,
  phone,
  email,
  data.jobTitle || data.targetJobTitle || ""
)}
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