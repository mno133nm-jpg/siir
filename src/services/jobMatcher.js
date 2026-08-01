import fs from "fs";
import path from "path";

const aliasesPath = path.resolve(
  "src/data/jobAliases.json"
);

function readAliases() {
  if (!fs.existsSync(aliasesPath)) {
    return {};
  }

  return JSON.parse(
    fs.readFileSync(aliasesPath, "utf8")
  );
}

function normalizeJobTitle(jobTitle = "") {
  return jobTitle
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeFileName(title = "") {
  return title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function getJobTemplate(jobTitle = "") {
  const normalizedTitle =
    normalizeJobTitle(jobTitle);

  if (!normalizedTitle) {
    return null;
  }

  const aliases = readAliases();

  const matchedAlias = Object.keys(
    aliases
  ).find(
    (alias) =>
      normalizeJobTitle(alias) ===
      normalizedTitle
  );

  if (!matchedAlias) {
    return null;
  }

  const templateKey =
    aliases[matchedAlias];

  const templatePath = path.resolve(
    `src/data/jobs/${templateKey}.json`
  );

  if (!fs.existsSync(templatePath)) {
    return null;
  }

  try {
    return JSON.parse(
      fs.readFileSync(templatePath, "utf8")
    );
  } catch (error) {
    console.error(
      `❌ تعذر قراءة قالب الوظيفة: ${templateKey}`,
      error
    );

    return null;
  }
}