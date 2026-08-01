import fs from "fs";
import path from "path";

import {
  getJobTemplate,
  normalizeFileName,
} from "./jobMatcher.js";

import {
  generateJobTemplate,
} from "./jobTemplateGenerator.js";

import {
  saveJobTemplate,
} from "./saveJobTemplate.js";

const aliasesPath = path.resolve(
  "src/data/jobAliases.json"
);

function readAliases() {
  if (!fs.existsSync(aliasesPath)) {
    return {};
  }

  try {
    return JSON.parse(
      fs.readFileSync(aliasesPath, "utf8")
    );
  } catch {
    return {};
  }
}
function saveAlias(jobTitle, fileName) {
  const aliases = readAliases();

  aliases[jobTitle.trim().toLowerCase()] = fileName;

  fs.writeFileSync(
    aliasesPath,
    JSON.stringify(aliases, null, 2),
    "utf8"
  );
}

function validateJobTemplate(template) {
  if (!template || typeof template !== "object") {
    throw new Error("قالب الوظيفة غير صالح");
  }

  const requiredArrays = [
    "skills",
    "responsibilities",
    "achievements",
    "keywords",
  ];

  if (
    typeof template.title !== "string" ||
    !template.title.trim()
  ) {
    throw new Error("عنوان الوظيفة غير موجود");
  }

  for (const field of requiredArrays) {
    if (!Array.isArray(template[field])) {
      throw new Error(
        `الحقل ${field} يجب أن يكون مصفوفة`
      );
    }
  }

  return template;
}

export async function getOrCreateJobTemplate(jobTitle) {
  console.log("🚀 دخلنا getOrCreateJobTemplate");
  console.log("📝 jobTitle المستلم:", jobTitle);

  if (!jobTitle || !jobTitle.trim()) {
    console.log("❌ المسمى فارغ");
    return null;
  }
  const existingTemplate =
    getJobTemplate(jobTitle);

  if (existingTemplate) {
    return {
      template: existingTemplate,
      source: "database",
    };
  }

  const generatedResult =
    await generateJobTemplate(jobTitle);

  let generatedTemplate;

try {
  if (typeof generatedResult === "string") {
    const cleanedResult = generatedResult
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    console.log(
      "📦 نتيجة قالب الوظيفة بعد التنظيف:",
      cleanedResult
    );

    generatedTemplate = JSON.parse(cleanedResult);
  } else {
    generatedTemplate = generatedResult;
  }
} catch (error) {
  console.error(
    "❌ فشل تحويل قالب الوظيفة إلى JSON:",
    generatedResult
  );

  throw new Error(
    `تعذر قراءة قالب الوظيفة: ${error.message}`
  );
}

  const validatedTemplate =
    validateJobTemplate(generatedTemplate);

  const fileName = normalizeFileName(jobTitle);

  if (!fileName) {
    throw new Error(
      "تعذر إنشاء اسم ملف للمسمى الوظيفي"
    );
  }

console.log("💾 سيتم حفظ القالب باسم:", fileName);

  saveJobTemplate(
    fileName,
    validatedTemplate
  );

  saveAlias(jobTitle, fileName);

  return {
    template: validatedTemplate,
    source: "generated",
  };
}