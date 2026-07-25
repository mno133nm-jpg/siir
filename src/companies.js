
import XLSX from "xlsx";

const workbook = XLSX.readFile("./companies.xlsx");

const sheet = workbook.Sheets[workbook.SheetNames[0]];

const companies = XLSX.utils.sheet_to_json(sheet);

export function getCompanies() {
  return companies;
}

export function searchCompanies(city, limit = 20) {
  return companies
    .filter(c =>
      c.City &&
      c.City.toLowerCase().includes(city.toLowerCase())
    )
    .slice(0, limit);
}