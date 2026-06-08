// Render trang HTML cua vong quay (server-side, nhung data nhung san vao trang).
import {PRIZES} from './config.js'

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  )
}

export function renderWheelPage({name, launchToken, alreadySpun, prize, grade, agsEnabled}) {
  // Du lieu cau hinh dua xuong client
  const bootstrap = {
    name,
    launchToken,
    prizes: PRIZES.map(({id, label, color}) => ({id, label, color})),
    alreadySpun: !!alreadySpun,
    prizeIndex: prize ? PRIZES.findIndex(p => p.id === prize.id) : -1,
    prizeLabel: prize ? prize.label : null,
    grade: grade || null,
    agsEnabled: !!agsEnabled,
  }

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vong quay may man</title>
  <link rel="stylesheet" href="/public/wheel.css" />
</head>
<body>
  <main class="app">
    <h1>Vong Quay May Man</h1>
    <p class="hello">Xin chao, <strong>${esc(name || 'ban')}</strong>!</p>

    <div class="wheel-wrap">
      <div class="pointer"></div>
      <canvas id="wheel" width="380" height="380" aria-label="Vong quay may man"></canvas>
    </div>

    <button id="spinBtn" class="spin-btn">QUAY NGAY</button>
    <p id="result" class="result" role="status" aria-live="polite"></p>
    <p id="grade" class="grade" role="status" aria-live="polite"></p>
    <p class="note">Moi sinh vien chi duoc quay <strong>1 lan</strong>.</p>
  </main>

  <script>window.__BOOT__ = ${JSON.stringify(bootstrap)};</script>
  <script src="/public/wheel.js"></script>
</body>
</html>`
}

export function renderError(message) {
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8" /><title>Loi</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 20px;color:#333}
code{background:#f4f4f4;padding:2px 6px;border-radius:4px}</style></head>
<body><h1>Khong the mo module</h1><p>${esc(message)}</p>
<p>Kiem tra lai cau hinh Developer Key / Client ID / URL trong file <code>.env</code>.</p>
</body></html>`
}
