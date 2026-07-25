import { Markup } from "telegraf";

export function menu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📄 تحليل السيرة الذاتية", "cv")],
    [Markup.button.callback("📝 إنشاء سيرة ذاتية", "create_cv")],
    [Markup.button.callback("🎯 تحليل الوصف الوظيفي", "job")],
    [Markup.button.callback("✉️ إنشاء Cover Letter", "cover")],
    [Markup.button.callback("👤 الملف الشخصي", "profile")]
  ]);
}