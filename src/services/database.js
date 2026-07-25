import fs from "fs";

const DB_PATH = "./data/db.json";

export function db() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync("./data", { recursive: true });

    fs.writeFileSync(
      DB_PATH,
      JSON.stringify(
        {
          users: {},
          applications: []
        },
        null,
        2
      )
    );
  }

  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

export function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}