module.exports = {
  supplier: "metrosports",

  baseUrl: process.env.BASE_URL,

  requestDelay: Number(process.env.REQUEST_DELAY || 300),

  concurrency: Number(process.env.MAX_CONCURRENT_REQUESTS || 4),

  cronSchedule: process.env.CRON_SCHEDULE,

  timezone: process.env.CRON_TIMEZONE,

  retryAttempts: 3,

  retryDelay: 1500,

  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
  },
};