import crypto from "crypto";
import { db, save } from "./database.js";

const NALPAY_BASE_URL =
  process.env.NALPAY_BASE_URL || "https://nalpay.io";

const NALPAY_SECRET_KEY =
  process.env.NALPAY_SECRET_KEY;

const NALPAY_WEBHOOK_SECRET =
  process.env.NALPAY_WEBHOOK_SECRET;

const PAYMENT_AMOUNT = 1000; // 10 ريال = 1000 هللة
const SUBSCRIPTION_DAYS = 30;

const PAYMENT_DESCRIPTION =
  "سير AI - اشتراك شهري";

function idempotencyKey(prefix, value = "") {
  return `${prefix}-${value || crypto.randomUUID()}`;
}

async function nalpayRequest(
  path,
  {
    method = "GET",
    body,
    idempotencyKey: key
  } = {}
) {
  if (!NALPAY_SECRET_KEY) {
    throw new Error(
      "NALPAY_SECRET_KEY is missing"
    );
  }

  const headers = {
    Accept: "application/json",
    Authorization:
      `Bearer ${NALPAY_SECRET_KEY}`,
    "Nalpay-Version": "2026-09-04"
  };

  if (method !== "GET") {
    headers["Content-Type"] =
      "application/json";

    headers["Idempotency-Key"] =
      key || idempotencyKey("sir-ai");
  }

  const response = await fetch(
    `${NALPAY_BASE_URL}${path}`,
    {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body)
    }
  );

  const text = await response.text();

  let data;

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch {
    throw new Error(
      `Nal Pay returned invalid JSON: ${text}`
    );
  }

  if (!response.ok) {
    const error =
      data?.error || {};

    throw new Error(
      `Nal Pay ${response.status}: ${
        error.code || "unknown"
      } - ${
        error.message || "Unknown error"
      }`
    );
  }

  return data;
}

function normalizeSaudiPhone(phone) {
  const value = String(phone || "")
    .trim()
    .replace(/[\s-]/g, "");

  if (/^05\d{8}$/.test(value)) {
    return `966${value.slice(1)}`;
  }

  if (/^\+9665\d{8}$/.test(value)) {
    return value.slice(1);
  }

  if (/^9665\d{8}$/.test(value)) {
    return value;
  }

  return null;
}

function ensureUser(userId, name = "") {
  const data = db();
  const id = String(userId);

  if (!data.users[id]) {
    data.users[id] = {
      id,
      name,
      email: "",
      cvText: "",
      profile: null,

      subscriptionActive: false,
      subscriptionType: null,
      subscriptionStartedAt: null,
      subscriptionExpiresAt: null,
      paymentId: null
    };

    save(data);
  }

  return data.users[id];
}

function activateSubscription(
  userId,
  paymentId
) {
  const data = db();
  const id = String(userId);

  if (!data.users[id]) {
    return null;
  }

  const user = data.users[id];

  const now = new Date();

  let startDate = now;

  if (
    user.subscriptionActive &&
    user.subscriptionExpiresAt
  ) {
    const oldExpiry =
      new Date(
        user.subscriptionExpiresAt
      );

    if (oldExpiry > now) {
      startDate = oldExpiry;
    }
  }

  const expiry =
    new Date(startDate);

  expiry.setDate(
    expiry.getDate() +
      SUBSCRIPTION_DAYS
  );

  user.subscriptionActive = true;
  user.subscriptionType = "monthly";
  user.subscriptionStartedAt =
    user.subscriptionStartedAt ||
    now.toISOString();

  user.subscriptionExpiresAt =
    expiry.toISOString();

  user.paymentId = paymentId;

  save(data);

  return expiry;
}

function verifyWebhookSignature(
  rawBody,
  signature
) {
  if (!NALPAY_WEBHOOK_SECRET) {
    throw new Error(
      "NALPAY_WEBHOOK_SECRET is missing"
    );
  }

  if (!signature) {
    throw new Error(
      "Missing Nalpay-Signature"
    );
  }

  const parts =
    signature.split(",");

  const timestampPart =
    parts.find((p) =>
      p.trim().startsWith("t=")
    );

  const signaturePart =
    parts.find((p) =>
      p.trim().startsWith("v1=")
    );

  if (
    !timestampPart ||
    !signaturePart
  ) {
    throw new Error(
      "Invalid Nalpay-Signature"
    );
  }

  const timestamp =
    Number(
      timestampPart
        .trim()
        .slice(2)
    );

  const receivedSignature =
    signaturePart
      .trim()
      .slice(3);

  const now =
    Math.floor(
      Date.now() / 1000
    );

  if (
    !Number.isFinite(timestamp) ||
    Math.abs(now - timestamp) > 300
  ) {
    throw new Error(
      "Expired webhook timestamp"
    );
  }

  const signedPayload =
    `${timestamp}.${rawBody}`;

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        NALPAY_WEBHOOK_SECRET
      )
      .update(
        signedPayload,
        "utf8"
      )
      .digest("hex");

  const expected =
    Buffer.from(
      expectedSignature,
      "utf8"
    );

  const received =
    Buffer.from(
      receivedSignature,
      "utf8"
    );

  if (
    expected.length !==
      received.length ||
    !crypto.timingSafeEqual(
      expected,
      received
    )
  ) {
    throw new Error(
      "Invalid webhook signature"
    );
  }

  return true;
}

function markWebhookProcessed(
  eventId
) {
  const data = db();

  if (!data.nalpayWebhookEvents) {
    data.nalpayWebhookEvents = {};
  }

  if (
    data.nalpayWebhookEvents[eventId]
  ) {
    return false;
  }

  data.nalpayWebhookEvents[eventId] = {
    processedAt:
      new Date().toISOString()
  };

  save(data);

  return true;
}

async function createPaymentLink(
  userId,
  customerId = null
) {
  const body = {
    amount: PAYMENT_AMOUNT,

    currency: "SAR",

    description:
      PAYMENT_DESCRIPTION,

    metadata: {
      telegramUserId:
        String(userId),

      plan: "monthly"
    },

    expires_at:
      new Date(
        Date.now() +
          24 * 60 * 60 * 1000
      ).toISOString()
  };

  if (customerId) {
    body.customer =
      customerId;
  }

  return nalpayRequest(
    "/v1/payment_links",
    {
      method: "POST",

      idempotencyKey:
        idempotencyKey(
          "sir-ai-payment",
          userId
        ),

      body
    }
  );
}

async function createCustomer(
  name,
  phone
) {
  return nalpayRequest(
    "/v1/customers",
    {
      method: "POST",

      idempotencyKey:
        idempotencyKey(
          "sir-ai-customer",
          phone
        ),

      body: {
        name:
          name ||
          "Sir AI User",

        phone
      }
    }
  );
}

async function handlePaidPayment(
  payment,
  bot
) {
  if (!payment) {
    return;
  }

  if (
    payment.status !== "paid"
  ) {
    return;
  }

  if (
    Number(payment.amount) !==
    PAYMENT_AMOUNT
  ) {
    console.log(
      "Nal Pay payment amount mismatch:",
      payment.id
    );

    return;
  }

  if (
    String(
      payment.currency
    ).toUpperCase() !==
    "SAR"
  ) {
    return;
  }

  const userId =
    payment.metadata
      ?.telegramUserId;

  if (!userId) {
    console.log(
      "Nal Pay payment has no Telegram user:",
      payment.id
    );

    return;
  }

  const expiry =
    activateSubscription(
      userId,
      payment.id
    );

  if (!expiry) {
    console.log(
      "Sir AI user not found:",
      userId
    );

    return;
  }

  try {
    await bot.telegram.sendMessage(
      String(userId),

      `🎉 تم تفعيل اشتراكك بنجاح!

💰 المبلغ: 10 ريال
⏳ المدة: شهر واحد
📅 تاريخ الانتهاء:
${expiry.toLocaleDateString(
  "ar-SA"
)}

🤖 استمتع بخدمات Sir AI`
    );
  } catch (error) {
    console.error(
      "Telegram notification error:",
      error.message
    );
  }

  console.log(
    `✅ Sir AI subscription activated for ${userId}`
  );
}

export function registerNalpayPayment(
  bot
) {
  bot.nalpaySessions =
    bot.nalpaySessions ||
    {};

  bot.action(
    "subscribe",
    async (ctx) => {
      await ctx.answerCbQuery();

      const userId =
        String(ctx.from.id);

      const user =
        ensureUser(
          userId,
          ctx.from.first_name
        );

      if (
        user.subscriptionActive &&
        user.subscriptionExpiresAt
      ) {
        const expiry =
          new Date(
            user.subscriptionExpiresAt
          );

        if (
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

      bot.nalpaySessions[
        userId
      ] = {
        step: "phone"
      };

      await ctx.reply(
        `💳 اشتراك Sir AI

💰 السعر: 10 ريال
⏳ المدة: شهر واحد

📱 أرسل رقم جوالك السعودي لإكمال الدفع.

مثال:
0500000000`
      );
    }
  );

  bot.on(
    "text",
    async (ctx, next) => {
      const userId =
        String(ctx.from.id);

      const session =
        bot.nalpaySessions[
          userId
        ];

      if (
        !session ||
        session.step !== "phone"
      ) {
        return next();
      }

      const phone =
        normalizeSaudiPhone(
          ctx.message.text
        );

      if (!phone) {
        return ctx.reply(
          `❌ رقم الجوال غير صحيح.

أرسل رقم سعودي مثل:
0500000000`
        );
      }

      try {
        await ctx.reply(
          "⏳ جاري تجهيز رابط الدفع..."
        );

        const user =
          ensureUser(
            userId,
            ctx.from.first_name
          );

        const account =
          await nalpayRequest(
            "/v1/account"
          );

        if (
          account?.capabilities
            ?.can_charge !== true
        ) {
          throw new Error(
            "Nal Pay account cannot charge"
          );
        }

        const customer =
          await createCustomer(
            user.name ||
              ctx.from.first_name,
            phone
          );

        const link =
          await createPaymentLink(
            userId,
            customer.id
          );

        bot.nalpaySessions[
          userId
        ] = null;

        await ctx.reply(
          `💳 رابط الدفع جاهز

💰 المبلغ: 10 ريال
⏳ الاشتراك: شهر واحد

اضغط الزر لإكمال الدفع 👇`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text:
                      "💳 دفع 10 ريال",
                    url: link.url
                  }
                ]
              ]
            }
          }
        );
      } catch (error) {
        console.error(
          "Nal Pay payment error:",
          error.message
        );

        bot.nalpaySessions[
          userId
        ] = null;

        await ctx.reply(
          "❌ تعذر إنشاء رابط الدفع حاليًا.\n\nحاول مرة أخرى لاحقًا."
        );
      }

      return;
    }
  );
}

export async function handleNalpayRequest(
  req,
  res,
  bot
) {
  const url =
    new URL(
      req.url,
      "https://siir-production-6845.up.railway.app"
    );

  if (
    req.method !== "POST" ||
    url.pathname !==
      "/hooks/nalpay"
  ) {
    return false;
  }

  try {
    const chunks = [];

    for await (
      const chunk of req
    ) {
      chunks.push(
        Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk)
      );
    }

    const rawBody =
      Buffer.concat(chunks)
        .toString("utf8");

    verifyWebhookSignature(
      rawBody,
      req.headers[
        "nalpay-signature"
      ]
    );

    const deliveryId =
      req.headers[
        "nalpay-delivery"
      ];

    if (!deliveryId) {
      throw new Error(
        "Missing Nalpay-Delivery"
      );
    }

    let event;

    try {
      event =
        JSON.parse(rawBody);
    } catch {
      throw new Error(
        "Invalid webhook JSON"
      );
    }

    const isNew =
      markWebhookProcessed(
        deliveryId
      );

    res.writeHead(200, {
      "Content-Type":
        "application/json"
    });

    res.end(
      JSON.stringify({
        received: true,
        duplicate: !isNew
      })
    );

    if (!isNew) {
      return true;
    }

    console.log(
      `🔔 Nal Pay Webhook: ${event.type}`
    );

    if (
      event.type ===
      "payment_paid"
    ) {
      await handlePaidPayment(
        event.data,
        bot
      );
    }

    if (
      event.type ===
      "payment_refunded"
    ) {
      console.log(
        "⚠️ Nal Pay payment refunded:",
        event.data?.id
      );
    }

    return true;
  } catch (error) {
    console.error(
      "❌ Nal Pay webhook error:",
      error.message
    );

    res.writeHead(400, {
      "Content-Type":
        "application/json"
    });

    res.end(
      JSON.stringify({
        received: false,
        error:
          "invalid_webhook"
      })
    );

    return true;
  }
}