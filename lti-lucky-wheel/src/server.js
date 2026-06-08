import path from 'node:path'
import {fileURLToPath} from 'node:url'
import express from 'express'

import {config, urls, PRIZES, AGS_CLAIM} from './config.js'
import {getKeys} from './keys.js'
import {getSpin, saveSpin} from './store.js'
import {drawPrize} from './draw.js'
import {reportPrizeScore} from './ags.js'
import {renderWheelPage, renderError} from './views.js'
import {
  CLAIM,
  createLoginState,
  consumeLoginState,
  verifyIdToken,
  signLaunchToken,
  verifyLaunchToken,
} from './lti.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(express.urlencoded({extended: true}))
app.use(express.json())
app.use('/public', express.static(path.join(__dirname, '..', 'public')))

// Trang chu - thong tin nhanh
app.get('/', (_req, res) => {
  res.type('html').send(`<h1>LTI Lucky Wheel</h1>
    <p>Tool dang chay. Cac endpoint LTI:</p>
    <ul>
      <li>OIDC login: <code>${urls.login}</code></li>
      <li>Launch (redirect_uri): <code>${urls.launch}</code></li>
      <li>JWKS: <code>${urls.jwks}</code></li>
      <li>Config JSON: <code>${urls.config}</code></li>
    </ul>`)
})

// ---- Buoc 1: OIDC login initiation (Canvas goi den, GET hoac POST) ----
function handleLogin(req, res) {
  const params = {...req.query, ...req.body}
  const {iss, login_hint, lti_message_hint, target_link_uri} = params

  if (!login_hint) {
    return res.status(400).type('html').send(renderError('Thieu login_hint trong OIDC login.'))
  }

  const {state, nonce} = createLoginState()

  const authUrl = new URL(config.canvas.authUrl)
  const q = authUrl.searchParams
  q.set('scope', 'openid')
  q.set('response_type', 'id_token')
  q.set('response_mode', 'form_post')
  q.set('prompt', 'none')
  q.set('client_id', config.clientId)
  q.set('redirect_uri', urls.launch)
  q.set('login_hint', login_hint)
  if (lti_message_hint) q.set('lti_message_hint', lti_message_hint)
  q.set('state', state)
  q.set('nonce', nonce)

  // target_link_uri/iss chi de tham khao/log
  void iss
  void target_link_uri

  res.redirect(authUrl.toString())
}
app.get('/login', handleLogin)
app.post('/login', handleLogin)

// ---- Buoc 3-5: Canvas POST id_token ve day. Verify roi render vong quay. ----
app.post('/launch', async (req, res) => {
  try {
    const {id_token, state} = req.body
    if (!id_token) throw new Error('Thieu id_token.')

    const entry = consumeLoginState(state)
    if (!entry) throw new Error('State khong hop le hoac het han (thu launch lai).')

    const claims = await verifyIdToken(id_token, entry.nonce)

    const sub = claims.sub
    const name = claims.name || claims.given_name || 'ban'

    // Lay claim AGS (neu Developer Key co scope AGS): chua lineitems URL + scope.
    const agsClaim = claims[AGS_CLAIM.ENDPOINT]
    const ags = agsClaim?.lineitems
      ? {lineitems: agsClaim.lineitems, scope: agsClaim.scope || []}
      : null

    // Da quay roi -> hien ket qua cu. Chua -> cho phep quay.
    const existing = getSpin(sub)
    const prize = existing ? PRIZES.find(p => p.id === existing.prizeId) : null

    // Nhung ca thong tin AGS vao launchToken (da ky) de /api/spin dung ghi diem.
    const launchToken = await signLaunchToken({sub, name, ags})

    res.type('html').send(
      renderWheelPage({
        name,
        launchToken,
        alreadySpun: !!existing,
        prize,
        grade: existing?.grade || null,
        agsEnabled: !!ags,
      }),
    )
  } catch (err) {
    console.error('Launch error:', err.message)
    res.status(400).type('html').send(renderError(err.message))
  }
})

// ---- API quay so: client gui launchToken, server quyet dinh ket qua ----
app.post('/api/spin', async (req, res) => {
  try {
    const {launchToken} = req.body
    const payload = await verifyLaunchToken(launchToken)
    const sub = payload.sub
    const ags = payload.ags

    const existing = getSpin(sub)
    if (existing) {
      const idx = PRIZES.findIndex(p => p.id === existing.prizeId)
      return res.json({
        alreadySpun: true,
        index: idx,
        prize: existing.label,
        grade: existing.grade || null,
      })
    }

    const {index, prize} = drawPrize()

    // Ghi diem thuong ve so diem Canvas qua AGS (best-effort: loi ghi diem
    // khong lam hong ket qua quay).
    let grade = null
    if (ags) {
      try {
        const r = await reportPrizeScore({ags, userId: sub, prize})
        grade = {ok: true, score: r.scoreGiven}
      } catch (e) {
        console.error('AGS error:', e.message)
        grade = {ok: false, error: e.message}
      }
    }

    saveSpin(sub, {
      prizeId: prize.id,
      label: prize.label,
      at: new Date().toISOString(),
      grade,
    })

    res.json({alreadySpun: false, index, prize: prize.label, grade})
  } catch (err) {
    console.error('Spin error:', err.message)
    res.status(400).json({error: err.message})
  }
})

// ---- JWKS cong khai cua tool ----
app.get('/jwks', async (_req, res) => {
  const {publicJwk} = await getKeys()
  res.json({keys: [publicJwk]})
})

// ---- Config JSON de dang ky LTI 1.3 trong Canvas ----
app.get('/config', (_req, res) => {
  res.json({
    title: 'Lucky Wheel',
    description: 'Vong quay may man - moi sinh vien quay 1 lan trung qua',
    oidc_initiation_url: urls.login,
    target_link_uri: urls.launch,
    public_jwk_url: urls.jwks,
    scopes: [],
    extensions: [
      {
        domain: new URL(config.toolUrl).host,
        platform: 'canvas.instructure.com',
        privacy_level: 'public',
        settings: {
          text: 'Lucky Wheel',
          placements: [
            {
              placement: 'course_navigation',
              message_type: 'LtiResourceLinkRequest',
              text: 'Vong quay may man',
              target_link_uri: urls.launch,
            },
          ],
        },
      },
    ],
  })
})

app.listen(config.port, () => {
  console.log(`\nLTI Lucky Wheel chay tai ${config.toolUrl} (port ${config.port})`)
  console.log(`  - Config JSON: ${urls.config}`)
  console.log(`  - JWKS:        ${urls.jwks}`)
  if (!config.clientId) {
    console.log(
      '\n  [!] Chua co CLIENT_ID. Dang ky Developer Key trong Canvas roi dien vao .env.\n',
    )
  }
})
