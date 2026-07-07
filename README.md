# Ludens Card — 個人品牌連結頁

Linktree 式個人名片＋落地頁。純靜態 HTML/CSS/JS，無框架、無建置步驟。
視覺：Ludens（Kojima Productions）工程美學 — 鈦白 65 / 碳黑 25 / 工業金 10 / 氧氣藍 2。

## 新增／修改連結

只需要編輯 **`js/links.js`** 一個檔案。複製一個物件、改內容、存檔即可：

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
