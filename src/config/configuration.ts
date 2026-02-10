export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookDomain: process.env.TELEGRAM_WEBHOOK_DOMAIN,
    allowedChatIds: process.env.TELEGRAM_ALLOWED_CHAT_IDS
      ? process.env.TELEGRAM_ALLOWED_CHAT_IDS.split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [],
  },
  llm: {
    provider: process.env.LLM_PROVIDER || 'claude',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
  },
  github: {
    token: process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPO,
    summaryDir: process.env.SUMMARY_DIR || '98-summaries',
  },
});
