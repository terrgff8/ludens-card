/* ==========================================================
   後台核心：WebCrypto 認證 + GitHub Contents API + 編輯器 UI
   admin.html 與 setup.html 共用本檔（依頁面 root 元素分流）。

   安全硬規則：
   - 來自檔案/使用者的字串只准 .value / .textContent 賦值，
     全檔禁止 innerHTML 接觸資料（防 PAT 外洩 XSS）
   - salt / iv 只用 crypto.getRandomValues
   - PAT 只存本檔閉包變數，不落任何 storage
   ========================================================== */
(function () {
  'use strict';

  var OWNER = 'terrgff8';
  var REPO = 'ludens-card';
  var API = 'https://api.github.com';
  var KDF_ITER = 1000000;
  var ICON_KEYS = ['github', 'x', 'instagram', 'youtube', 'mail', 'globe', 'file', 'link'];
  var LINKS_HEADER = '/* ADMIN-MANAGED. 由後台 admin.html 管理。手動編輯請維持 JSON 格式：鍵要雙引號，資料結尾必須是 ]; 後面不要加任何東西。 */';

  var te = new TextEncoder();
  var td = new TextDecoder();

  /* ---------- base64 ---------- */
  function b64ToBytes(b64) {
    var bin = atob(b64.replace(/\s/g, ''));
    var a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function bytesToB64(bytes) {
    var bin = '';
    var CHUNK = 0x8000;
    for (var i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  function textToB64(text) { return bytesToB64(te.encode(text)); }
  function b64ToText(b64) { return td.decode(b64ToBytes(b64)); }

  /* ---------- crypto ---------- */
  function randB64(n) {
    var a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return bytesToB64(a);
  }
  function deriveKey(username, password, saltB64, iter) {
    return crypto.subtle.importKey('raw', te.encode(username + '\n' + password), 'PBKDF2', false, ['deriveKey'])
      .then(function (material) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: b64ToBytes(saltB64), iterations: iter, hash: 'SHA-256' },
          material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }
  function encryptPAT(key, pat, ivB64) {
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: b64ToBytes(ivB64) }, key, te.encode(pat))
      .then(function (ct) { return bytesToB64(new Uint8Array(ct)); });
  }
  function decryptPAT(key, ivB64, ctB64) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(ivB64) }, key, b64ToBytes(ctB64))
      .then(function (pt) { return td.decode(pt); });
  }

  /* ---------- links.js 解析／序列化 ---------- */
  function parseLinksFile(text) {
    var idx = text.indexOf('const LINKS');
    if (idx < 0) throw new Error('links.js 格式異常：找不到 const LINKS。請用 git 歷史回滾。');
    var start = text.indexOf('[', idx);
    var end = text.lastIndexOf(']');
    if (start < 0 || end <= start) throw new Error('links.js 格式異常：陣列邊界損毀。請用 git 歷史回滾。');
    return JSON.parse(text.slice(start, end + 1));
  }
  function serializeLinksFile(arr) {
    return LINKS_HEADER + '\nconst LINKS = ' + JSON.stringify(arr, null, 2) + ';\n';
  }

  /* ---------- profile.js 解析／序列化（同 links 的錨定策略） ---------- */
  var PROFILE_HEADER = '/* ADMIN-MANAGED. 由後台 admin.html 管理。手動編輯請維持 JSON 格式：鍵要雙引號，結尾必須是 }; 後面不要加任何東西。 */';
  var PROFILE_DEFAULTS = { name: '', tagline: '', bio: '', initial: '' };
  function parseProfileFile(text) {
    var idx = text.indexOf('const PROFILE');
    if (idx < 0) throw new Error('profile.js 格式異常：找不到 const PROFILE。請用 git 歷史回滾。');
    var start = text.indexOf('{', idx);
    var end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('profile.js 格式異常：物件邊界損毀。請用 git 歷史回滾。');
    return JSON.parse(text.slice(start, end + 1));
  }
  function serializeProfileFile(obj) {
    return PROFILE_HEADER + '\nconst PROFILE = ' + JSON.stringify(obj, null, 2) + ';\n';
  }

  /* ---------- GitHub API ---------- */
  var PAT = null;            // 登入後才有值；登出清空
  var shaCache = {};         // path -> sha

  function ghHeaders(token) {
    return {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json'
    };
  }
  function ghGetFile(token, path) {
    return fetch(API + '/repos/' + OWNER + '/' + REPO + '/contents/' + path + '?t=' + Date.now(),
      { headers: ghHeaders(token), cache: 'no-store' })
      .then(function (r) {
        if (r.status === 404) { shaCache[path] = null; return null; }
        if (r.status === 401 || r.status === 403) throw new Error('PAT 無效、過期或被撤銷 — 請重跑 setup.html');
        if (!r.ok) throw new Error('GitHub 讀取失敗 HTTP ' + r.status);
        return r.json().then(function (j) {
          shaCache[path] = j.sha;
          return { sha: j.sha, text: b64ToText(j.content) };
        });
      });
  }
  function ghPutFile(token, path, bareB64, message, isRetry) {
    var body = { message: message, content: bareB64 };
    if (shaCache[path]) body.sha = shaCache[path];
    return fetch(API + '/repos/' + OWNER + '/' + REPO + '/contents/' + path,
      { method: 'PUT', headers: ghHeaders(token), cache: 'no-store', body: JSON.stringify(body) })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) {
          throw new Error('寫入被拒：PAT 過期、被撤銷或缺 Contents 寫入權 — 請重跑 setup.html 換新 PAT');
        }
        if ((r.status === 409 || r.status === 422) && !isRetry) {
          // sha 衝突：重抓一次再試
          return ghGetFile(token, path).then(function () {
            return ghPutFile(token, path, bareB64, message, true);
          });
        }
        if (!r.ok) throw new Error('GitHub 寫入失敗 HTTP ' + r.status);
        return r.json().then(function (j) {
          shaCache[path] = j.content.sha;   // 同 session 連續儲存不衝突
          return j;
        });
      });
  }

  /* auth.json：登入時走 API + no-store，避開 Pages CDN 舊快取 */
  function fetchAuthBlob() {
    return fetch(API + '/repos/' + OWNER + '/' + REPO + '/contents/auth.json?t=' + Date.now(),
      { headers: { 'Accept': 'application/vnd.github+json' }, cache: 'no-store' })
      .then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) {
          // API 額度用完等狀況 → 退回同源抓（可能略舊，但比擋掉好）
          return fetch('auth.json?t=' + Date.now(), { cache: 'no-store' })
            .then(function (r2) {
              if (r2.status === 404) return null;
              if (!r2.ok) throw new Error('讀取 auth.json 失敗');
              return r2.json();
            });
        }
        return r.json().then(function (j) { return JSON.parse(b64ToText(j.content)); });
      });
  }

  /* ---------- 密碼強度（setup 用） ---------- */
  function estimateEntropy(pw) {
    if (!pw) return 0;
    var pool = 0;
    if (/[a-z]/.test(pw)) pool += 26;
    if (/[A-Z]/.test(pw)) pool += 26;
    if (/[0-9]/.test(pw)) pool += 10;
    if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
    var bits = pw.length * Math.log2(pool || 1);
    if (/(.{3,})\1/.test(pw)) bits -= 15;                       // 重複片段（如 24582458）
    if (/(0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf|password|admin|iloveyou)/i.test(pw)) bits -= 20;
    if (/(\d)\1{2,}/.test(pw)) bits -= 10;                      // 疊數字
    return Math.max(0, Math.round(bits));
  }
  function passwordProblems(pw, pw2) {
    var problems = [];
    if (pw.length < 12) problems.push('至少 12 個字元');
    if (/^\d+$/.test(pw)) problems.push('不可純數字');
    if (estimateEntropy(pw) < 70) problems.push('強度不足（估算 ' + estimateEntropy(pw) + ' bits，需 ≥70）— 建議按「產生隨機密碼」');
    if (pw2 !== undefined && pw !== pw2) problems.push('兩次密碼不一致');
    return problems;
  }
  function generatePassword() {
    // base58（去掉易混淆字元），4 組 5 字 ≈ 117 bits
    var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    var bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    var out = '';
    for (var i = 0; i < 20; i++) {
      if (i > 0 && i % 5 === 0) out += '-';
      out += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return out;
  }

  /* 測試探針用匯出（純函式，無秘密） */
  window.__admin = {
    deriveKey: deriveKey, encryptPAT: encryptPAT, decryptPAT: decryptPAT,
    parseLinksFile: parseLinksFile, serializeLinksFile: serializeLinksFile,
    parseProfileFile: parseProfileFile, serializeProfileFile: serializeProfileFile,
    estimateEntropy: estimateEntropy, generatePassword: generatePassword,
    randB64: randB64, textToB64: textToB64, b64ToText: b64ToText
  };

  /* ==========================================================
     admin.html
     ========================================================== */
  function $(id) { return document.getElementById(id); }

  function initAdmin() {
    var loginView = $('view-login');
    var editorView = $('view-editor');
    var loginBtn = $('login-btn');
    var loginErr = $('login-err');
    var statusEl = $('status-line');
    var linksArr = [];
    var pendingAvatarB64 = null;

    function status(msg) { statusEl.textContent = msg; }
    function loginError(msg) { loginErr.textContent = msg; loginBtn.disabled = false; loginBtn.textContent = 'ENTER'; }

    /* ----- 登入 ----- */
    function doLogin() {
      var user = $('login-user').value.trim();
      var pass = $('login-pass').value;
      if (!user || !pass) { loginError('帳號密碼都要填'); return; }
      loginErr.textContent = '';
      loginBtn.disabled = true;
      loginBtn.textContent = 'LOADING CONFIG...';

      fetchAuthBlob().then(function (blob) {
        if (!blob) throw new Error('NOT_SETUP');
        loginBtn.textContent = 'DERIVING KEY...';
        return deriveKey(user, pass, blob.salt, blob.iter || KDF_ITER).then(function (key) {
          loginBtn.textContent = 'DECRYPTING...';
          return decryptPAT(key, blob.iv, blob.ct).catch(function () { throw new Error('BAD_CREDS'); });
        });
      }).then(function (pat) {
        loginBtn.textContent = 'VERIFYING...';
        return fetch(API + '/repos/' + OWNER + '/' + REPO, { headers: ghHeaders(pat), cache: 'no-store' })
          .then(function (r) {
            if (!r.ok) throw new Error('PAT 無效或已被撤銷 — 請重跑 setup.html');
            return r.json();
          })
          .then(function (repo) {
            if (!repo.permissions || !repo.permissions.push) {
              throw new Error('這把 PAT 沒有寫入權（Contents: Read and write）— 請重跑 setup.html');
            }
            PAT = pat;
          });
      }).then(function () {
        loginView.hidden = true;
        editorView.hidden = false;
        status('登入成功，載入資料中...');
        initAvatarPreview();
        loadProfile();
        return loadLinks();
      }).catch(function (e) {
        if (e.message === 'NOT_SETUP') loginError('尚未設定 — 請先開 setup.html 完成一次性設定');
        else if (e.message === 'BAD_CREDS') loginError('帳號或密碼錯誤');
        else loginError(e.message);
      });
    }
    loginBtn.addEventListener('click', doLogin);
    $('login-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });

    /* ----- 登出 ----- */
    $('logout-btn').addEventListener('click', function () {
      PAT = null;
      shaCache = {};
      linksArr = [];
      pendingAvatarB64 = null;
      editorView.hidden = true;
      loginView.hidden = false;
      loginBtn.disabled = false;
      loginBtn.textContent = 'ENTER';
      $('login-pass').value = '';
    });

    /* ----- 個人資料 ----- */
    function loadProfile() {
      return ghGetFile(PAT, 'js/profile.js').then(function (f) {
        var p = f ? parseProfileFile(f.text) : PROFILE_DEFAULTS;   // 舊部署沒這檔 → 空白，儲存時建檔
        $('p-name').value = p.name || '';
        $('p-tagline').value = p.tagline || '';
        $('p-bio').value = p.bio || '';
        $('p-initial').value = p.initial || '';
      }).catch(function (e) { status('個人資料載入錯誤：' + e.message); });
    }

    $('save-profile-btn').addEventListener('click', function () {
      var profile = {
        name: $('p-name').value.trim(),
        tagline: $('p-tagline').value.trim(),
        bio: $('p-bio').value.trim(),
        initial: $('p-initial').value.trim()
      };
      if (!profile.name) { status('名稱必填'); return; }
      if (profile.initial.length > 2) { status('頭像縮寫最多 2 個字'); return; }
      var btn = $('save-profile-btn');
      btn.disabled = true;
      status('儲存個人資料中...');
      ghPutFile(PAT, 'js/profile.js', textToB64(serializeProfileFile(profile)), 'admin: update profile')
        .then(function () { status('個人資料已儲存 ✓ 正式站 1–10 分鐘生效'); })
        .catch(function (e) { status('儲存失敗：' + e.message); })
        .then(function () { btn.disabled = false; });
    });

    /* ----- 連結編輯器 ----- */
    function loadLinks() {
      return ghGetFile(PAT, 'js/links.js').then(function (f) {
        if (!f) throw new Error('repo 裡找不到 js/links.js');
        linksArr = parseLinksFile(f.text);
        renderCards();
        status('已載入 ' + linksArr.length + ' 條連結');
      }).catch(function (e) { status('錯誤：' + e.message); });
    }

    function makeField(labelText, value, cls) {
      var wrap = document.createElement('label');
      wrap.className = 'field';
      var span = document.createElement('span');
      span.textContent = labelText;                 // 只用 textContent
      var input = document.createElement('input');
      input.type = 'text';
      input.value = value || '';                    // 只用 .value 屬性賦值
      input.className = cls;
      wrap.appendChild(span);
      wrap.appendChild(input);
      return wrap;
    }

    function renderCards() {
      var box = $('link-cards');
      while (box.firstChild) box.removeChild(box.firstChild);

      linksArr.forEach(function (item, i) {
        var card = document.createElement('div');
        card.className = 'card-row';

        card.appendChild(makeField('LABEL（按鈕大字）', item.label, 'f-label'));
        card.appendChild(makeField('SUBLABEL（小字，可留白）', item.sublabel, 'f-sublabel'));
        card.appendChild(makeField('URL', item.url, 'f-url'));

        var iconWrap = document.createElement('label');
        iconWrap.className = 'field';
        var iconSpan = document.createElement('span');
        iconSpan.textContent = 'ICON';
        var sel = document.createElement('select');
        sel.className = 'f-icon';
        ICON_KEYS.forEach(function (k) {
          var opt = document.createElement('option');
          opt.value = k;
          opt.textContent = k;
          sel.appendChild(opt);
        });
        sel.value = ICON_KEYS.indexOf(item.icon) >= 0 ? item.icon : 'link';
        iconWrap.appendChild(iconSpan);
        iconWrap.appendChild(sel);
        card.appendChild(iconWrap);

        var hlWrap = document.createElement('label');
        hlWrap.className = 'field field--check';
        var hl = document.createElement('input');
        hl.type = 'checkbox';
        hl.className = 'f-highlight';
        hl.checked = !!item.highlight;
        hl.addEventListener('change', function () {
          if (hl.checked) {
            // 金底強調款全站最多一個：勾新的自動取消其他
            box.querySelectorAll('.f-highlight').forEach(function (other) {
              if (other !== hl) other.checked = false;
            });
          }
        });
        var hlSpan = document.createElement('span');
        hlSpan.textContent = '金底強調款（最多一個）';
        hlWrap.appendChild(hl);
        hlWrap.appendChild(hlSpan);
        card.appendChild(hlWrap);

        var tools = document.createElement('div');
        tools.className = 'card-tools';
        [['↑ 上移', -1], ['↓ 下移', 1]].forEach(function (pair) {
          var b = document.createElement('button');
          b.type = 'button';
          b.textContent = pair[0];
          b.addEventListener('click', function () {
            collectCards();
            var j = i + pair[1];
            if (j < 0 || j >= linksArr.length) return;
            var tmp = linksArr[i]; linksArr[i] = linksArr[j]; linksArr[j] = tmp;
            renderCards();
          });
          tools.appendChild(b);
        });
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-danger';
        del.textContent = '刪除';
        del.addEventListener('click', function () {
          collectCards();
          linksArr.splice(i, 1);
          renderCards();
        });
        tools.appendChild(del);
        card.appendChild(tools);

        box.appendChild(card);
      });
    }

    function collectCards() {
      var rows = $('link-cards').querySelectorAll('.card-row');
      var arr = [];
      rows.forEach(function (row) {
        arr.push({
          label: row.querySelector('.f-label').value.trim(),
          sublabel: row.querySelector('.f-sublabel').value.trim(),
          url: row.querySelector('.f-url').value.trim(),
          icon: row.querySelector('.f-icon').value,
          highlight: row.querySelector('.f-highlight').checked
        });
      });
      linksArr = arr;
    }

    $('add-link-btn').addEventListener('click', function () {
      collectCards();
      linksArr.push({ label: '', sublabel: '', url: '', icon: 'link', highlight: false });
      renderCards();
      var cards = $('link-cards').querySelectorAll('.card-row');
      cards[cards.length - 1].scrollIntoView({ behavior: 'smooth' });
    });

    $('save-links-btn').addEventListener('click', function () {
      collectCards();
      for (var i = 0; i < linksArr.length; i++) {
        var it = linksArr[i];
        if (!it.label) { status('第 ' + (i + 1) + ' 條缺 LABEL'); return; }
        if (!/^(https?:\/\/|mailto:|tel:)/i.test(it.url)) {
          status('第 ' + (i + 1) + ' 條 URL 必須以 https:// 、http:// 、mailto: 或 tel: 開頭'); return;
        }
        if (!it.sublabel) delete it.sublabel;
      }
      var btn = $('save-links-btn');
      btn.disabled = true;
      status('儲存中...');
      ghPutFile(PAT, 'js/links.js', textToB64(serializeLinksFile(linksArr)), 'admin: update links')
        .then(function () { status('已儲存 ✓ 正式站 1–10 分鐘生效'); })
        .catch(function (e) { status('儲存失敗：' + e.message); })
        .then(function () { btn.disabled = false; });
    });

    /* ----- 大頭貼 ----- */
    function initAvatarPreview() {
      var img = $('avatar-preview');
      img.addEventListener('error', function () {
        img.hidden = true;
        $('avatar-none').hidden = false;
      }, { once: true });
      img.src = 'assets/avatar.jpg?t=' + Date.now();
    }

    function fileToResizedJpeg(file, maxSide) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          var w = Math.round(img.width * scale);
          var h = Math.round(img.height * scale);
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('圖片讀取失敗')); };
        img.src = url;
      });
    }

    $('avatar-file').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      fileToResizedJpeg(file, 512).then(function (dataURL) {
        pendingAvatarB64 = dataURL.split(',')[1];   // 去掉 data:image/jpeg;base64, 前綴
        var img = $('avatar-preview');
        img.hidden = false;
        $('avatar-none').hidden = true;
        img.src = dataURL;                          // 本地即時預覽
        $('avatar-upload-btn').disabled = false;
        status('已選擇新頭像（縮至最長邊 512px），按「上傳頭像」送出');
      }).catch(function (e) { status('錯誤：' + e.message); });
    });

    $('avatar-upload-btn').addEventListener('click', function () {
      if (!pendingAvatarB64) { status('先選一張圖片'); return; }
      var btn = $('avatar-upload-btn');
      btn.disabled = true;
      status('上傳頭像中...');
      ghGetFile(PAT, 'assets/avatar.jpg')            // 先抓 sha（沒有=首次上傳）
        .then(function () {
          return ghPutFile(PAT, 'assets/avatar.jpg', pendingAvatarB64, 'admin: update avatar');
        })
        .then(function () {
          pendingAvatarB64 = null;
          status('頭像已上傳 ✓ 正式站 1–10 分鐘生效（手機請重新整理）');
        })
        .catch(function (e) { status('上傳失敗：' + e.message); btn.disabled = false; });
    });
  }

  /* ==========================================================
     setup.html
     ========================================================== */
  function initSetup() {
    var msg = $('setup-msg');
    function say(text, ok) {
      msg.textContent = text;
      msg.className = ok ? 'msg msg--ok' : 'msg msg--err';
    }

    $('gen-pass-btn').addEventListener('click', function () {
      var pw = generatePassword();
      $('setup-pass').value = pw;
      $('setup-pass2').value = pw;
      $('setup-pass').type = 'text';               // 讓使用者看得到以便抄寫
      $('entropy-line').textContent = '強度：約 117 bits（隨機產生）— 請立刻抄進密碼管理器';
    });

    $('setup-pass').addEventListener('input', function () {
      var bits = estimateEntropy(this.value);
      $('entropy-line').textContent = this.value ? ('強度估算：' + bits + ' bits（需 ≥70）') : '';
    });

    function buildAuthJson() {
      var pat = $('setup-pat').value.trim();
      var user = $('setup-user').value.trim();
      var pass = $('setup-pass').value;
      var pass2 = $('setup-pass2').value;

      if (!pat) { say('請貼上 fine-grained PAT', false); return null; }
      if (!user) { say('請填帳號', false); return null; }
      var problems = passwordProblems(pass, pass2);
      if (problems.length) { say('密碼問題：' + problems.join('；'), false); return null; }

      var salt = randB64(16);
      var iv = randB64(12);
      return deriveKey(user, pass, salt, KDF_ITER)
        .then(function (key) { return encryptPAT(key, pat, iv); })
        .then(function (ct) {
          return { v: 1, kdf: 'PBKDF2-SHA256', iter: KDF_ITER, salt: salt, iv: iv, ct: ct };
        });
    }

    $('setup-write-btn').addEventListener('click', function () {
      var btn = this;
      var pat = $('setup-pat').value.trim();
      btn.disabled = true;
      say('驗證 PAT...', true);

      fetch(API + '/repos/' + OWNER + '/' + REPO, { headers: ghHeaders(pat), cache: 'no-store' })
        .then(function (r) {
          if (r.status === 401) {
            throw new Error('token 字串無效（HTTP 401）— 不是過不過期的問題：通常是「沒複製完整」。回 GitHub 重新產生，按複製鈕拿到 github_pat_ 開頭的整串再貼上（前後不能少字、不能多空格）');
          }
          if (r.status === 404) {
            throw new Error('token 摸不到 ludens-card（HTTP 404）— 建立時 Repository access 必須選「Only select repositories」並勾 ludens-card。另外確認你用的是 Fine-grained 頁面建的（settings/personal-access-tokens/new），不是舊版 tokens 頁');
          }
          if (!r.ok) {
            return r.json().catch(function () { return {}; }).then(function (j) {
              throw new Error('PAT 驗證失敗 HTTP ' + r.status + (j.message ? '：' + j.message : ''));
            });
          }
          return r.json();
        })
        .then(function (repo) {
          if (!repo.permissions || !repo.permissions.push) {
            throw new Error('這把 PAT 沒有寫入權 — Permissions 要勾 Contents: Read and write');
          }
          say('加密中（約需數秒）...', true);
          var p = buildAuthJson();
          if (!p) throw new Error('SILENT');
          return p;
        })
        .then(function (authObj) {
          say('寫入 auth.json...', true);
          return ghGetFile(pat, 'auth.json').then(function () {
            return ghPutFile(pat, 'auth.json', textToB64(JSON.stringify(authObj)), 'setup: rotate admin credentials');
          });
        })
        .then(function () {
          $('setup-form').hidden = true;
          $('setup-done').hidden = false;
        })
        .catch(function (e) {
          if (e.message !== 'SILENT') say(e.message, false);
        })
        .then(function () { btn.disabled = false; });
    });

    $('setup-print-btn').addEventListener('click', function () {
      var btn = this;
      btn.disabled = true;
      var p = buildAuthJson();
      if (!p) { btn.disabled = false; return; }
      p.then(function (authObj) {
        var ta = $('setup-output');
        ta.hidden = false;
        ta.value = JSON.stringify(authObj);
        say('已產生 — 請自行 commit 成 repo 根目錄的 auth.json', true);
      }).catch(function (e) { say(e.message, false); })
        .then(function () { btn.disabled = false; });
    });
  }

  /* ---------- 分流 ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    if ($('admin-root')) initAdmin();
    if ($('setup-root')) initSetup();
  });
})();
