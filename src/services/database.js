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

  const data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));

  // التأكد من وجود الأقسام الأساسية
  if (!data.users) data.users = {};
  if (!data.applications) data.applications = [];

  // إضافة بيانات الاشتراك للمستخدمين الحاليين بدون حذف أي بيانات
  for (const userId in data.users) {
    const user = data.users[userId];

    if (user.subscriptionActive === undefined) {
      user.subscriptionActive = false;
    }

    if (user.subscriptionType === undefined) {
      user.subscriptionType = null;
    }

    if (user.subscriptionStartedAt === undefined) {
      user.subscriptionStartedAt = null;
    }

    if (user.subscriptionExpiresAt === undefined) {
      user.subscriptionExpiresAt = null;
    }

    if (user.paymentId === undefined) {
      user.paymentId = null;
    }
  }

  return data;
}

export function save(data) {
  fs.mkdirSync("./data", { recursive: true });

  fs.writeFileSync(
    DB_PATH,
    JSON.stringify(data, null, 2)
  );
}