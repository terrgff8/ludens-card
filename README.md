# Ludens Card — 個人品牌連結頁

Linktree 式個人名片＋落地頁。純靜態 HTML/CSS/JS，無框架、無建置步驟。
視覺：Ludens（Kojima Productions）工程美學 — 鈦白 65 / 碳黑 25 / 工業金 10 / 氧氣藍 2。

## 後台（免 git 直接改）

- 後台網址：`https://terrgff8.github.io/ludens-card/admin.html`
- 首次設定：開 `https://terrgff8.github.io/ludens-card/setup.html`，照頁面步驟建 fine-grained PAT（只限本 repo、只有 Contents 讀寫）→ 設帳密 → 加密寫入
- 登入後可：上傳大頭貼、編輯／新增／刪除／排序所有連結
- 修改生效時間：1–10 分鐘（GitHub Pages 建置＋CDN 快取），手機請重新整理
- **換密碼／疑似外洩**：重跑 setup.html 並**貼一把新 PAT**，完成後到 GitHub 撤銷舊 PAT — 只改密碼不換 PAT 等於沒換鎖（舊加密檔永遠留在 git 歷史）
- PAT 到期：同上，重跑 setup.html
- 安全模型：`auth.json` 是公開的加密檔，防線在密碼強度 — 用 setup 頁產生的隨機密碼（約 117 bits）最穩

## 新增／修改連結（手動方式）

也可以直接編輯 **`js/links.js`**（注意：後台管理格式，鍵要雙引號）。複製一個物件、改內容、存檔即可：

```js
{
  label: "GITHUB",              // 必填，會渲染成全大寫
  sublabel: "code & projects",  // 選填，按鈕下方小字
  url: "https://github.com/terrgff8",  // 必填
  icon: "github",               // 選填：github / x / instagram / youtube /
                                //       mail / globe / file / link
  highlight: false              // true = 金底強調款（最多一個）
}
```

- 缺 `url` 的項目會被跳過（console 有警告）
- `icon` 打錯或留空自動用預設鏈結圖示
- `mailto:` / `tel:` 連結不會開新分頁

## 換文案／頭像

編輯 `index.html`：
- `<h1 class="name">` — 姓名
- `<p class="tagline">` — 標語
- `<p class="bio">` — 簡介
- `.avatar-frame` SVG 裡的 `YN` — 姓名縮寫（或整個換成 `<img>`）

## 本機預覽

```
python -m http.server 8123
```
開 http://localhost:8123

## 重新部署

改完檔案後：

```
git add -A
git commit -m "update links"
git push
```

GitHub Pages 會在 push 後約 1 分鐘自動更新。

## 自訂網域（未來選配）

1. 在 repo 根目錄加 `CNAME` 檔，內容一行：你的網域（例 `links.example.tw`）
2. DNS 加 CNAME 記錄指向 `terrgff8.github.io`
3. repo Settings → Pages → Custom domain 填入同網域並勾 Enforce HTTPS
