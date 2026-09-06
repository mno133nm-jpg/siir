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

  const token =
    crypto.randomBytes(24).toString("hex");

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
// ربط زر الاشتراك في Telegram
// ===============================

export function registerMoyasarPayment(bot) {

  bot.action("subscribe", async (ctx) => {

    await ctx.answerCbQuery();

    const link =
      createPaymentLink(ctx.from.id);

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
// استقبال صفحات الدفع
// ===============================

export async function handleMoyasarRequest(
  req,
  res,
  bot
) {

  const url =
    new URL(
      req.url,
      PUBLIC_URL
    );


  // صفحة الدفع
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


  // الصفحة الرئيسية للاختبار
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

  const token =
    crypto.randomBytes(24).toString("hex");

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
// ربط زر الاشتراك في Telegram
// ===============================

export function registerMoyasarPayment(bot) {

  bot.action("subscribe", async (ctx) => {

    await ctx.answerCbQuery();

    const link =
      createPaymentLink(ctx.from.id);

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
// استقبال صفحات الدفع
// ===============================

export async function handleMoyasarRequest(
  req,
  res,
  bot
) {

  const url =
    new URL(
      req.url,
      PUBLIC_URL
    );


  // صفحة الدفع
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


  // الصفحة الرئيسية للاختبار
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