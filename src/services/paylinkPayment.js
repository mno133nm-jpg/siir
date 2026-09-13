import { db, save } from "./database.js";
import crypto from "crypto";

const PUBLIC_URL =
  process.env.PUBLIC_URL ||
  "https://siir-production-6845.up.railway.app";

const PAYLINK_API_ID =
  process.env.PAYLINK_API_ID;

const PAYLINK_SECRET_KEY =
  process.env.PAYLINK_SECRET_KEY;

const PAYLINK_BASE_URL =
  process.env.PAYLINK_BASE_URL ||
  "https://restapi.paylink.sa";

const PAYMENT_AMOUNT = 9;

// ===============================
// Paylink Authentication
// ===============================
async function getPaylinkToken() {
  if (!PAYLINK_API_ID || !PAYLINK_SECRET_KEY) {
    throw new Error(
      "PAYLINK_API_ID or PAYLINK_SECRET_KEY is missing"
    );
  }

  const response = await fetch(
    `${PAYLINK_BASE_URL}/api/auth`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apiId: PAYLINK_API_ID,
        secretKey: PAYLINK_SECRET_KEY,
        persistToken: true
      })
    }
  );

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Paylink authentication returned non-JSON response: ${text.slice(
        0,
        300
      )}`
    );
  }

  if (!response.ok || !data.id_token) {
    throw new Error(
      `Paylink authentication failed: ${JSON.stringify(data)}`
    );
  }

  return data.id_token;
}

// ===============================
// إنشاء فاتورة Paylink
// ===============================
async function createPaylinkInvoice({
  userId,
  clientName,
  clientEmail,
  clientMobile
}) {
  const token = await getPaylinkToken();

  const orderNumber =
    `SIR-${userId}-${Date.now()}-${crypto
      .randomBytes(4)
      .toString("hex")}`;

  const response = await fetch(
    `${PAYLINK_BASE_URL}/api/addInvoice`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        orderNumber,
        amount: PAYMENT_AMOUNT,
        callBackUrl:
          `${PUBLIC_URL}/payment/paylink/callback`,
        cancelUrl:
          `${PUBLIC_URL}/payment/paylink/cancel`,
        clientName:
          clientName || "Sir AI User",
        clientEmail:
          clientEmail || undefined,
        clientMobile,
        currency: "SAR",
        products: [
          {
            title: "سير AI — اشتراك شهري",
            price: PAYMENT_AMOUNT,
            qty: 1,
            description:
              "اشتراك شهري في منصة سير AI",
            isDigital: true
          }
        ],
        note:
          "اشتراك شهري في Sir AI"
      })
    }
  );

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Paylink addInvoice returned non-JSON response: ${text.slice(
        0,
        500
      )}`
    );
  }

  if (!response.ok || !data.success) {
    throw new Error(
      `Paylink invoice creation failed: ${JSON.stringify(data)}`
    );
  }

  return {
    ...data,
    orderNumber
  };
}

// ===============================
// حفظ عملية الدفع
// ===============================
function savePendingPayment({
  orderNumber,
  userId,
  transactionNo
}) {
  const data = db();

  if (!data.pendingPayments) {
    data.pendingPayments = {};
  }

  data.pendingPayments[orderNumber] = {
    userId: String(userId),
    orderNumber,
    transactionNo,
    amount: PAYMENT_AMOUNT,
    currency: "SAR",
    status: "pending",
    createdAt: new Date().toISOString()
  };

  save(data);
}

// ===============================
// تفعيل الاشتراك
// ===============================
function activateSubscription(
  userId,
  paymentId
) {
  const data = db();

  if (!data.users) {
    data.users = {};
  }

  const id = String(userId);

  if (!data.users[id]) {
    data.users[id] = {};
  }

  const user = data.users[id];

  const now = new Date();

  let startDate = now;

  if (
    user.subscriptionActive &&
    user.subscriptionExpiresAt
  ) {
    const oldExpiry =
      new Date(user.subscriptionExpiresAt);

    if (oldExpiry > now) {
      startDate = oldExpiry;
    }
  }

  const expiry = new Date(startDate);

  expiry.setMonth(
    expiry.getMonth() + 1
  );

  user.subscriptionActive = true;
  user.subscriptionType = "monthly";
  user.subscriptionStartedAt =
    now.toISOString();
  user.subscriptionExpiresAt =
    expiry.toISOString();
  user.paymentId = paymentId;

  save(data);

  return expiry;
}

// ===============================
// التحقق من الفاتورة
// ===============================
async function getPaylinkInvoice(
  transactionNo
) {
  const token =
    await getPaylinkToken();

  const response = await fetch(
    `${PAYLINK_BASE_URL}/api/getInvoice/${encodeURIComponent(
      transactionNo
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    }
  );

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Paylink getInvoice returned non-JSON response: ${text.slice(
        0,
        500
      )}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Paylink getInvoice failed: ${JSON.stringify(data)}`
    );
  }

  return data;
}

// ===============================
// معالجة الدفع وتفعيل الاشتراك
// ===============================
async function processSuccessfulPayment({
  orderNumber,
  transactionNo,
  bot
}) {
  const data = db();

  const pending =
    data.pendingPayments?.[orderNumber];

  if (!pending) {
    throw new Error(
      "Pending Paylink payment not found"
    );
  }

  // منع التفعيل مرتين
  if (pending.status === "paid") {
    return {
      alreadyProcessed: true
    };
  }

  const invoice =
    await getPaylinkInvoice(
      transactionNo
    );

  console.log(
    "Paylink invoice:",
    {
      transactionNo:
        invoice.transactionNo,
      status:
        invoice.orderStatus,
      amount:
        invoice.amount
    }
  );

  const status =
    String(
      invoice.orderStatus || ""
    ).toUpperCase();

  const amount =
    Number(invoice.amount);

  if (
    status !== "PAID" ||
    amount !== PAYMENT_AMOUNT
  ) {
    pending.status =
      invoice.orderStatus || "failed";

    save(data);

    throw new Error(
      `Payment not confirmed. Status=${status}, Amount=${amount}`
    );
  }

  const expiry =
    activateSubscription(
      pending.userId,
      transactionNo
    );

  const updatedData = db();

  updatedData.pendingPayments[
    orderNumber
  ] = {
    ...updatedData.pendingPayments[
      orderNumber
    ],
    status: "paid",
    paymentId: transactionNo,
    paidAt:
      new Date().toISOString()
  };

  save(updatedData);

  try {
    await bot.telegram.sendMessage(
      pending.userId,
      `🎉 تم تفعيل اشتراكك بنجاح!

💳 العملية: ${transactionNo}
💰 المبلغ: 9 ريال
⏳ الاشتراك: شهر واحد
📅 ينتهي في:
${expiry.toLocaleDateString("ar-SA")}

استمتع بخدمات Sir AI 🤖`
    );
  } catch (telegramError) {
    console.error(
      "Telegram notification failed:",
      telegramError.message
    );
  }

  return {
    alreadyProcessed: false,
    expiry
  };
}

// ===============================
// Telegram
// ===============================
export function registerPaylinkPayment(
  bot
) {
  bot.action(
    "subscribe",
    async (ctx) => {
      await ctx.answerCbQuery();

      const data = db();

      const id =
        String(ctx.from.id);

      if (!data.users) {
        data.users = {};
      }

      if (!data.users[id]) {
        data.users[id] = {
          id,
          name:
            ctx.from.first_name || "",
          email: "",
          cvText: "",
          profile: null
        };

        save(data);
      }

      const user =
        data.users[id];

      if (user.subscriptionActive) {
        const expiry =
          user.subscriptionExpiresAt
            ? new Date(
                user.subscriptionExpiresAt
              )
            : null;

        if (
          expiry &&
          expiry > new Date()
        ) {
          return ctx.reply(
            `✅ اشتراكك فعال بالفعل.

📅 ينتهي في:
${expiry.toLocaleDateString(
  "ar-SA"
)}`
          );
        }
      }

      await ctx.reply(
        `💳 الاشتراك في Sir AI

💰 السعر: 9 ريال
⏳ المدة: شهر واحد

📱 أرسل رقم جوالك لإكمال الدفع.

مثال:
0500000000`
      );

      bot.contexts = bot.contexts || {};

      bot.contexts[id] = {
        step: "paylink_phone"
      };
    }
  );

  bot.on(
    "text",
    async (ctx, next) => {
      const id =
        String(ctx.from.id);

      const paymentContext =
        bot.contexts?.[id];

      if (
        !paymentContext ||
        paymentContext.step !==
          "paylink_phone"
      ) {
        return next();
      }

      const phone =
        ctx.message.text.trim();

      const normalizedPhone =
        phone.replace(
          /[\s-]/g,
          ""
        );

      if (
        !/^05\d{8}$/.test(
          normalizedPhone
        ) &&
        !/^\+9665\d{8}$/.test(
          normalizedPhone
        )
      ) {
        return ctx.reply(
          `❌ رقم الجوال غير صحيح.

أرسل رقم سعودي مثل:
0500000000`
        );
      }

      let clientMobile =
        normalizedPhone;

      if (
        clientMobile.startsWith("05")
      ) {
        clientMobile =
          "+966" +
          clientMobile.slice(1);
      }

      try {
        await ctx.reply(
          "⏳ جاري تجهيز رابط الدفع..."
        );

        const data = db();

        const user =
          data.users?.[id] || {};

        const invoice =
          await createPaylinkInvoice({
            userId: id,
            clientName:
              user.name ||
              ctx.from.first_name ||
              "Sir AI User",
            clientEmail:
              user.email || "",
            clientMobile
          });

        savePendingPayment({
          orderNumber:
            invoice.orderNumber,
          userId: id,
          transactionNo:
            invoice.transactionNo
        });

        delete bot.contexts[id];

        await ctx.reply(
          `💳 تم تجهيز طلب الدفع

💰 المبلغ: 9 ريال
⏳ الاشتراك: شهر واحد

اضغط الزر لإكمال الدفع 👇`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text:
                      "💳 الانتقال للدفع",
                    url:
                      invoice.url
                  }
                ]
              ]
            }
          }
        );
      } catch (error) {
        console.error(
          "Paylink invoice error:",
          error
        );

        delete bot.contexts[id];

        await ctx.reply(
          "❌ تعذر إنشاء رابط الدفع حاليًا.\n\nحاول مرة أخرى لاحقًا."
        );
      }

      return;
    }
  );
}

// ===============================
// HTTP Requests
// ===============================
export async function handlePaylinkRequest(
  req,
  res,
  bot
) {
  const url = new URL(
    req.url,
    PUBLIC_URL
  );

  // ===============================
  // Callback
  // ===============================
  if (
    req.method === "GET" &&
    url.pathname ===
      "/payment/paylink/callback"
  ) {
    const orderNumber =
      url.searchParams.get(
        "orderNumber"
      );

    const transactionNo =
      url.searchParams.get(
        "transactionNo"
      );

    if (
      !orderNumber ||
      !transactionNo
    ) {
      res.writeHead(400, {
        "Content-Type":
          "text/html; charset=utf-8"
      });

      return res.end(`
        <div dir="rtl"
          style="font-family:Arial;text-align:center;margin:50px">
          <h2>❌ بيانات الدفع غير مكتملة</h2>
        </div>
      `);
    }

    try {
      await processSuccessfulPayment({
        orderNumber,
        transactionNo,
        bot
      });

      res.writeHead(200, {
        "Content-Type":
          "text/html; charset=utf-8"
      });

      return res.end(`
        <div dir="rtl"
          style="font-family:Arial;text-align:center;margin:50px">
          <h1>🎉 تم الدفع بنجاح</h1>
          <h2>تم تفعيل اشتراك Sir AI</h2>
          <p>يمكنك العودة إلى Telegram الآن.</p>
        </div>
      `);
    } catch (error) {
      console.error(
        "Paylink callback error:",
        error
      );

      res.writeHead(400, {
        "Content-Type":
          "text/html; charset=utf-8"
      });

      return res.end(`
        <div dir="rtl"
          style="font-family:Arial;text-align:center;margin:50px">
          <h2>❌ لم يتم تأكيد الدفع</h2>
          <p>يرجى العودة إلى Telegram والمحاولة مرة أخرى.</p>
        </div>
      `);
    }
  }

  // ===============================
  // Cancel
  // ===============================
  if (
    req.method === "GET" &&
    url.pathname ===
      "/payment/paylink/cancel"
  ) {
    res.writeHead(200, {
      "Content-Type":
        "text/html; charset=utf-8"
    });

    return res.end(`
      <div dir="rtl"
        style="font-family:Arial;text-align:center;margin:50px">
        <h2>❌ تم إلغاء عملية الدفع</h2>
        <p>يمكنك العودة إلى Telegram والمحاولة مرة أخرى.</p>
      </div>
    `);
  }

  // ===============================
  // Webhook
  // ===============================
  if (
    req.method === "POST" &&
    url.pathname ===
      "/webhooks/paylink"
  ) {
    try {
      let body = "";

      for await (
        const chunk of req
      ) {
        body += chunk;
      }

      const payload =
        JSON.parse(body);

      console.log(
        "Paylink Webhook:",
        payload
      );

      const orderNumber =
        payload.merchantOrderNumber;

      const transactionNo =
        payload.transactionNo;

      if (
        !orderNumber ||
        !transactionNo
      ) {
        res.writeHead(200, {
          "Content-Type":
            "application/json"
        });

        return res.end(
          JSON.stringify({
            received: true
          })
        );
      }

      const status =
        String(
          payload.orderStatus || ""
        ).toUpperCase();

      if (status !== "PAID") {
        res.writeHead(200, {
          "Content-Type":
            "application/json"
        });

        return res.end(
          JSON.stringify({
            received: true,
            status
          })
        );
      }

      await processSuccessfulPayment({
        orderNumber,
        transactionNo,
        bot
      });

      res.writeHead(200, {
        "Content-Type":
          "application/json"
      });

      return res.end(
        JSON.stringify({
          received: true,
          activated: true
        })
      );
    } catch (error) {
      console.error(
        "Paylink webhook error:",
        error
      );

      res.writeHead(500, {
        "Content-Type":
          "application/json"
      });

      return res.end(
        JSON.stringify({
          error:
            "Webhook processing failed"
        })
      );
    }
  }

  return false;
}