# 8AKER零（8aker0.com）— 給 AI 助手的專案說明

網站主人：Baker Lin（住大阪的台灣人，自由工作者，程式小白）。這是他的個人內容站，也是一人公司的門面。

## 怎麼跟 Baker 合作（最重要）
- 用**繁體中文**回覆，條列、重點優先，白話、不要艱深術語；一次講一個簡單步驟。
- 直接做，做完說明「做了什麼、為什麼」。模糊的需求先做最合理版本，再補說明與替代方案。
- **絕對不要刪除任何檔案或分支**，要刪一定先問、等他明確同意。不可逆操作前先告知。
- **不要叫他把金鑰、密碼貼進對話**。金鑰只放在 Vercel／Supabase 的後台設定，不寫進程式碼、不寫進文件。
- 不要擅自花錢（例如 Higgsfield 生成點數、付費服務），要用先問。
- 發文、發社群、改公開內容前先問；文章預設存**草稿**。
- 設計講究美感與品味：深酒紅＋金色的主視覺，避免工程味的描述與介面。

## 技術概況
- **Astro 5** 靜態網站；推到 GitHub `main`，**Vercel 自動部署**（約 1 分鐘）。
- 只推 `main`。推之前先 `git pull --rebase origin main`；修改盡量**合併成一次推送**（Vercel 有部署次數限制）。
- `npm run build` 會先跑 `scripts/gen-redirects.mjs`（依 `src/data/works.json`、`shortlinks.json` 重新產生 `vercel.json` 的短網址轉址），再 `astro build`。**不要手動改 `vercel.json` 的 redirects**，會被覆蓋。
- 本機預覽：`npm install` → `npm run dev`。

## 目錄
- `src/content/{strengthen,emit,operate,conjure,transmute}/*.md`：日常紀錄文章，對應五個方向（強化／放出／操作／具現／變化）。欄位：`title`、`date`、`excerpt`、`tags`、`draft`、`status`、`also`、`work`。
  - `also` = 副分類（選填、最多一個）：文章網址與主分類仍以資料夾為準，但也會列在另一個方向的清單，標示「來自・〇〇」；首頁與各方向篇數只算主分類。
  - 公開與否只看 `draft`（`true` = 網站看不到）。`status` 是給後台區分「草稿」與「暫時關閉」用：`paused` = 暫時關閉。
  - 正文有「## 常見問題」＋「### 問題」時，文章頁會自動輸出 FAQ 結構化資料。
- `src/pages/`：頁面。`src/components/`：元件（`BodyPanel.astro` 是強化頁的身體儀表板）。`src/data/`：站上文案與資料（works、pillars、site-copy 等）。
- `public/studio/index.html`：**Studio 後台**（單一大檔案，寫文章、收件匣、AI 佇列、身體資料）。大改時再考慮拆檔。
- `api/`：Vercel 函式——Google 登入（只有站長帳號）、`/api/gh`（以 GitHub App 代為讀寫 repo）、`studio_verify` 等。
- `supabase/functions/`：9 支後端函式的**唯一原始碼**（見該資料夾的 README）。改完要再部署到 Supabase；不要只在後台改。

## 資料與安全
- Supabase 專案的 13 張表全開 RLS、沒有公開 policy，只有後端函式（service role）能讀寫。
- 公開的函式（`health-public`、`inquiry`、`tw-bank`、`wish-actions`）靠 Origin 檢查、蜜罐、IP 限流；Studio 函式靠 `s8.*` token，回頭呼叫 `/api/studio_verify` 驗證。
- 原始的身體資料不進 GitHub，只有站長核准的彙總文章才會。
- 身體儀表板的 Strava 同步只在 `health-public` 做；`health-studio` 只回報連線狀態。

## 排程任務（Claude 自動跑）
- AI 佇列處理：每天 08:13／13:13／22:13（日本時間），處理 Studio 送出的順稿、搭骨架、檢查、三語版本。
- 每週小結：週日 20:27 寫 `weekly_notes`，21:00 由 LINE 推送週報。

## 已知待辦
- 後台 `/studio` 單檔拆分（等下次大改）。
- 儀表板備用資料（`body.json`）改成「暫時讀不到」狀態。
- 規劃中：文章公開後自動生成 IG／Threads／YouTube 素材（先做文案與圖卡，發佈前由 Baker 確認，不要全自動發出）。
