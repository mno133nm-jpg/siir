import { db, save } from "./database.js";
import crypto from "crypto";

const PUBLIC_URL =
  process.env.PUBLIC_URL ||
  "https://siir-production-6845.up.railway.app";

const PUBLISHABLE_KEY =
  process.env.MOYASAR_PUBLISHABLE_KEY;

const SECRET_KEY =
  process.env.MOYASAR_SECRET_KEY;

const PAYMENT_AMOUNT =
  Number(process.env.PAYMENT_AMOUNT_HALALAS || 20000);


// ===============================
// إنشاء رابط دفع
// ===============================

export function createPaymentLink(userId) {
  const token = crypto.randomBytes(24).toString("hex");

  const data = db();

  if (!data.pendingPayments) {
    data.pendingPayments = {};
  }

  data.pendingPayments[token] = {
    userId: String(userId),
    amount: PAYMENT_AMOUNT,
    currency: "SAR",
    status: "pending",
    createdAt: new Date().toISOString()
  };

  save(data);

  return `${PUBLIC_URL}/pay?token=${token}`;
}


// ===============================
// زر الاشتراك في Telegram
// ===============================

export function registerMoyasarPayment(bot) {
  bot.action("subscribe", async (ctx) => {
    await ctx.answerCbQuery();

    const link = createPaymentLink(ctx.from.id);

    await ctx.reply(
      `💳 الاشتراك في Sir AI

💰 السعر: 9 ريال
⏳ المدة: شهر واحد

اضغط الزر لإكمال الدفع:`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: " الدفع عبر Apple Pay",
                url: link
              }
            ]
          ]
        }
      }
    );
  });
}


// ===============================
// التحقق من الدفع من Moyasar
// ===============================

async function verifyPayment(paymentId) {
  if (!SECRET_KEY) {
    throw new Error("MOYASAR_SECRET_KEY is missing");
  }

  const response = await fetch(
    `https://api.moyasar.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${SECRET_KEY}:`).toString("base64")
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `Moyasar verification failed: ${response.status}`
    );
  }

  return await response.json();
}


// ===============================
// تفعيل الاشتراك
// ===============================

function activateSubscription(userId, paymentId) {
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
// استقبال صفحات الدفع
// ===============================

export async function handleMoyasarRequest(
  req,
  res,
  bot
) {
  const url = new URL(
    req.url,
    PUBLIC_URL
  );


  // ===============================
  // صفحة الدفع
  // ===============================

  if (
    req.method === "GET" &&
    url.pathname === "/pay"
  ) {
    const token =
      url.searchParams.get("token");

    if (!token) {
      res.writeHead(400, {
        "Content-Type":
          "text/plain; charset=utf-8"
      });

      return res.end(
        "رابط الدفع غير صحيح"
      );
    }

    const data = db();

    const payment =
      data.pendingPayments?.[token];

    if (!payment) {
      res.writeHead(404, {
        "Content-Type":
          "text/plain; charset=utf-8"
      });

      return res.end(
        "رابط الدفع غير صالح"
      );
    }

    const html = `
<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>اشتراك Sir AI</title>

<script src="https://cdn.moyasar.com/mpf/1.15.0/moyasar.js"></script>

<link
  rel="stylesheet"
  href="https://cdn.moyasar.com/mpf/1.15.0/moyasar.css"
>

</head>

<body>

<div
  style="
    max-width:500px;
    margin:40px auto;
    padding:20px;
    font-family:Arial;
    text-align:center;
  "
>

<h1>🤖 Sir AI</h1>

<h2>اشتراك شهري</h2>

<p>9 ريال لمدة شهر</p>

<div class="mysr-form"></div>

</div>

<script>

Moyasar.init({

  element: '.mysr-form',

  amount: ${PAYMENT_AMOUNT},

  currency: 'SAR',

  description: 'Sir AI - اشتراك شهري',

  publishable_api_key:
    '${PUBLISHABLE_KEY}',

  callback_url:
    '${PUBLIC_URL}/payment/callback?token=${token}',

  methods: [
    'applepay'
  ],

  apple_pay: {

    country: 'SA',

    label: 'Sir AI',

    validate_merchant_url:
      'https://api.moyasar.com/v1/applepay/initiate'

  },

  metadata: {

    payment_token:
      '${token}'

  }

});

</script>

</body>

</html>
`;

    res.writeHead(200, {
      "Content-Type":
        "text/html; charset=utf-8"
    });

    return res.end(html);
  }


  // ===============================
  // نتيجة الدفع والتحقق منها
  // ===============================

  if (
    req.method === "GET" &&
    url.pathname === "/payment/callback"
  ) {
    const token =
      url.searchParams.get("token");

    const paymentId =
      url.searchParams.get("id");

    if (!token || !paymentId) {
      res.writeHead(400, {
        "Content-Type":
          "text/html; charset=utf-8"
      });

      return res.end(`
        <div dir="rtl" style="font-family:Arial;text-align:center;margin:50px">
          <h2>❌ تعذر التحقق من عملية الدفع</h2>
          <p>بيانات الدفع غير مكتملة.</p>
        </div>
      `);
    }

    try {
      const data = db();

      const pending =
        data.pendingPayments?.[token];

      if (!pending) {
        throw new Error(
          "Payment token not found"
        );
      }

      // منع استخدام نفس العملية أكثر من مرة
      if (pending.status === "paid") {
        res.writeHead(200, {
          "Content-Type":
            "text/html; charset=utf-8"
        });

        return res.end(`
          <div dir="rtl" style="font-family:Arial;text-align:center;margin:50px">
            <h2>✅ الاشتراك مفعل مسبقًا</h2>
            <p>يمكنك العودة إلى Telegram.</p>
          </div>
        `);
      }

      const payment =
        await verifyPayment(paymentId);

      console.log(
        "Moyasar payment verification:",
        payment.id,
        payment.status,
        payment.amount,
        payment.currency
      );

      // التحقق من العملية
      if (
        payment.status !== "paid" ||
        payment.amount !== pending.amount ||
        payment.currency !== pending.currency
      ) {
        pending.status =
          payment.status || "failed";

        save(data);

        res.writeHead(400, {
          "Content-Type":
            "text/html; charset=utf-8"
        });

        return res.end(`
          <div dir="rtl" style="font-family:Arial;text-align:center;margin:50px">
            <h2>❌ لم يتم تأكيد الدفع</h2>
            <p>حالة العملية: ${payment.status || "غير معروفة"}</p>
          </div>
        `);
      }

      // تفعيل الاشتراك
      const expiry =
        activateSubscription(
          pending.userId,
          payment.id
        );

      // تحديث العملية
      const updatedData = db();

      updatedData.pendingPayments[token] = {
        ...updatedData.pendingPayments[token],
        status: "paid",
        paymentId: payment.id,
        paidAt: new Date().toISOString()
      };

      save(updatedData);

      // إرسال رسالة للمستخدم
      try {
        await bot.telegram.sendMessage(
          pending.userId,
          `🎉 تم تفعيل اشتراكك بنجاح!

💳 العملية: ${payment.id}
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

      res.writeHead(200, {
        "Content-Type":
          "text/html; charset=utf-8"
      });

      return res.end(`
        <div dir="rtl" style="font-family:Arial;text-align:center;margin:50px">
          <h1>🎉 تم الدفع بنجاح</h1>
          <h2>تم تفعيل اشتراك Sir AI</h2>
          <p>يمكنك العودة إلى Telegram الآن.</p>
        </div>
      `);

    } catch (error) {
      console.error(
        "Moyasar callback error:",
        error
      );

      res.writeHead(500, {
        "Content-Type":
          "text/html; charset=utf-8"
      });

      return res.end(`
        <div dir="rtl" style="font-family:Arial;text-align:center;margin:50px">
          <h2>❌ حدث خطأ أثناء التحقق من الدفع</h2>
          <p>يرجى المحاولة مرة أخرى.</p>
        </div>
      `);
    }
  }


  // ===============================
  // اختبار النظام
  // ===============================

  if (
    req.method === "GET" &&
    url.pathname === "/payment/test"
  ) {
    res.writeHead(200, {
      "Content-Type":
        "text/plain; charset=utf-8"
    });

    return res.end(
      "Moyasar payment system is ready"
    );
  }


  return false;
}