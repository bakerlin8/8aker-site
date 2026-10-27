# Supabase Edge Functions（13 個）

這裡是 **唯一的原始碼來源**。改動一律改這裡，再用 Supabase MCP 或 CLI 部署，不要只在 Supabase 後台改。
全部 `verify_jwt = false`（函式自己驗身份），部署時要把 `index.ts` 和同資料夾的其他檔案一起送。

| 函式 | 誰呼叫 | 用途 | 驗證方式 |
|---|---|---|---|
| `health-public` | 強化頁（公開） | 身體儀表的彙總資料；每 6 小時順便同步 Strava（全部歷史＋1/5/10 公里最佳成績） | 無（只回彙總） |
| `health-ingest` | iPhone 捷徑 | 收體重、體脂、步數、步行距離（`walk_km`，公里）、運動分鐘 | `x-8aker-key`（只存 SHA-256） |
| `health-studio` | Studio | 後台身體資料、Strava 連線設定、金鑰重生 | Studio token（s8.*） |
| `inquiry` | 需求填表（公開） | 存進 inquiries | Origin＋蜜罐＋IP 限流 |
| `tw-bank` | 支持贊助（公開） | 留資料後回傳台灣轉帳帳號 | Origin＋蜜罐＋IP 限流 |
| `wish-actions` | 祈願所（公開） | ♡ 與想法 | Origin＋IP 限流 |
| `work-actions` | 作品頁（公開）＋Studio | 作品互動數字：試玩次數、♡ 我有興趣、想要自己的版本（只記數字，IP 只存單向雜湊）；Studio 用 `action:'stats'` 取彙總 | 公開端：Origin＋蜜罐＋IP 限流；Studio 端：s8.* token |
| `studio-inbox` | Studio | 收件匣、轉帳帳號設定 | Studio token |
| `studio-suggest` | Studio | 即時 AI 寫作助手（Gemini：標題、角度、大綱、開頭、續寫、改寫、查錯字、查事實、摘要、標籤、FAQ、社群文案、順稿、去 AI 化口氣、讀者視角、三語版本、起承轉合引導的起因整理／解決方法／觀點提問／觀點段落），金鑰在函式秘密變數 `GEMINI_API_KEY`，每天上限 60 次 | Studio token |
| `studio-ai` | Studio | AI 佇列（ai_jobs）、通知設定 | Studio token |
| `lib-collect` | iPhone 捷徑（IG／Threads／YouTube 分享選單） | 素材庫收件：收連結、去重、盡力抓標題與縮圖，存進 `lib_items` | `x-8aker-key`（只存 SHA-256，app_config.lib_key_sha256） |
| `lib-studio` | Studio「素材庫」 | 列出、新增、更新、刪除 `lib_items` | Studio token |
| `notify` | pg_cron `notify_tick()`（每 30 分鐘跑一次，依 notify_settings 的 hour＋minute 決定發不發） | LINE 每日提醒／週統整 | `x-notify-key`（app_config.notify_key） |

Studio token 的驗證都是回頭打 `https://8aker0.com/api/studio_verify`（Vercel）確認。

Strava 同步只在 `health-public` 做；`health-studio` 只回報連線狀態（2026-10-23 起）。

2026-10-26：`studio-inbox` 的 repo 原始碼先前缺少 `wish_ideas`／`wish_idea_update`（線上版有），已從線上版補回，之後部署以 repo 為準。
