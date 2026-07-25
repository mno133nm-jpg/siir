export function registerCV(bot, sessions) {
  bot.action("cv", async (ctx) => {
    await ctx.answerCbQuery();

    sessions.set(ctx.from.id, {
      step: "cv",
    });

    await ctx.reply("📄 أرسل السيرة الذاتية بصيغة PDF.");
  });
}