/* ==========================================================
   連結資料 — 這是你唯一需要編輯的檔案
   ==========================================================
   每個連結是一個物件：
   {
     label:     "GITHUB",              // 必填，會渲染成全大寫
     sublabel:  "code & projects",     // 選填，按鈕下方的小字
     url:       "https://...",         // 必填，缺了會跳過並在 console 警告
     icon:      "github",              // 選填，可用：github / x / instagram /
                                       //   youtube / mail / globe / file / link
                                       //   打錯或留空 → 自動用 "link"
     highlight: false                  // 選填，true = 金底強調款（最多一個）
   }
   新增連結 = 複製一個物件、改內容、存檔、重新整理。
   ========================================================== */

const LINKS = [
  {
    label: "GITHUB",
    sublabel: "code & projects",
    url: "https://github.com/terrgff8",
    icon: "github",
    highlight: false
  },
  {
    label: "PORTFOLIO",
    sublabel: "selected works",
    url: "https://example.com/portfolio",
    icon: "globe",
    highlight: false
  },
  {
    label: "X / TWITTER",
    sublabel: "daily thoughts",
    url: "https://x.com/placeholder",
    icon: "x",
    highlight: false
  },
  {
    label: "INSTAGRAM",
    sublabel: "visual log",
    url: "https://instagram.com/placeholder",
    icon: "instagram",
    highlight: false
  },
  {
    label: "YOUTUBE",
    sublabel: "video channel",
    url: "https://youtube.com/@placeholder",
    icon: "youtube",
    highlight: false
  },
  {
    label: "EMAIL",
    sublabel: "direct contact",
    url: "mailto:terrgff8@gmail.com",
    icon: "mail",
    highlight: false
  }
];
