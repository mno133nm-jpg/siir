import fs from "fs";
import path from "path";

export function saveJobTemplate(fileName, jsonData) {
  const jobsDirectory = path.resolve(
    "src/data/jobs"
  );

  fs.mkdirSync(jobsDirectory, {
    recursive: true,
  });

  const filePath = path.join(
    jobsDirectory,
    `${fileName}.json`
  );

  fs.writeFileSync(
    filePath,
    JSON.stringify(jsonData, null, 2),
    "utf8"
  );

  console.log(
    "✅ تم حفظ قالب الوظيفة في:",
    filePath
  );

  return filePath;
}