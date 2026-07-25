import fs from "fs";
import path from "path";

const companiesPath = path.join(process.cwd(), "companies.json");

export function getCompanies() {

  if (!fs.existsSync(companiesPath)) {
    return [];
  }

  const data = fs.readFileSync(companiesPath, "utf8");

  return JSON.parse(data);

}