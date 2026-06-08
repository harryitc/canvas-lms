// ===== Luong TOOL -> CANVAS (LTI Advantage - AGS) =====
// Tool tu ky client_assertion bang private key cua minh -> xin access token o
// token endpoint cua Canvas -> dung token do goi AGS de ghi diem vao so diem.
//
// Canvas verify client_assertion bang public_jwk cua Tool (file
// lib/canvas/oauth/asymmetric_client_credentials_provider.rb).
import crypto from 'node:crypto'
import {SignJWT} from 'jose'
import {config, AGS_MAX, AGS_SCOPES} from './config.js'
import {getKeys} from './keys.js'

const JWT_BEARER = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'

// (1) Tao client_assertion: JWT ky bang khoa rieng cua Tool.
//     iss = sub = client_id ; aud = token endpoint cua Canvas.
async function buildClientAssertion() {
  const {privateKey, alg, publicJwk} = await getKeys()
  return new SignJWT({})
    .setProtectedHeader({alg, kid: publicJwk.kid})
    .setIssuer(config.clientId)
    .setSubject(config.clientId)
    .setAudience(config.canvas.tokenUrl) // == oauth2_token_url ma Canvas ky vong
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime('5m')
    .sign(privateKey)
}

// (2) Doi client_assertion lay access_token (grant_type=client_credentials).
async function getAccessToken(scopes) {
  const assertion = await buildClientAssertion()
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: JWT_BEARER,
    client_assertion: assertion,
    scope: scopes.join(' '),
  })

  const res = await fetch(config.canvas.tokenUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Xin access_token that bai (HTTP ${res.status}): ${text}`)
  return JSON.parse(text).access_token
}

// (3) Tim line item "Lucky Wheel" (theo resourceId), neu chua co thi tao moi.
async function ensureLineItem(lineitemsUrl, token) {
  // GET danh sach line item hien co
  const listRes = await fetch(lineitemsUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.ims.lis.v2.lineitemcontainer+json',
    },
  })
  if (listRes.ok) {
    const items = await listRes.json()
    const found = items.find(it => it.resourceId === 'lucky-wheel')
    if (found) return found.id
  }

  // Chua co -> tao moi
  const createRes = await fetch(lineitemsUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/vnd.ims.lis.v2.lineitem+json',
    },
    body: JSON.stringify({
      scoreMaximum: AGS_MAX,
      label: 'Lucky Wheel',
      resourceId: 'lucky-wheel',
      tag: 'lucky-wheel',
    }),
  })
  const text = await createRes.text()
  if (!createRes.ok) throw new Error(`Tao line item that bai (HTTP ${createRes.status}): ${text}`)
  return JSON.parse(text).id
}

// (4) Ghi diem cho 1 sinh vien len line item.
async function postScore(lineItemUrl, token, {userId, scoreGiven, comment}) {
  // URL scores = <lineitem>/scores (chen truoc query neu co)
  const [base, query] = lineItemUrl.split('?')
  const scoresUrl = `${base}/scores${query ? `?${query}` : ''}`

  const res = await fetch(scoresUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/vnd.ims.lis.v1.score+json',
    },
    body: JSON.stringify({
      userId,
      scoreGiven,
      scoreMaximum: AGS_MAX,
      comment,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      timestamp: new Date().toISOString(),
    }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Ghi diem that bai (HTTP ${res.status}): ${text}`)
  return true
}

// ===== Ham tong: tu access_token -> line item -> ghi diem =====
// `ags` lay tu claim AGS trong id_token (chua lineitems URL + scope duoc cap).
export async function reportPrizeScore({ags, userId, prize}) {
  if (!ags?.lineitems) throw new Error('id_token khong co claim AGS (lineitems)')

  const token = await getAccessToken([AGS_SCOPES.LINEITEM, AGS_SCOPES.SCORE])
  const lineItemUrl = await ensureLineItem(ags.lineitems, token)
  await postScore(lineItemUrl, token, {
    userId,
    scoreGiven: prize.points ?? 0,
    comment: `Vong quay may man: trung "${prize.label}" (+${prize.points ?? 0} diem)`,
  })
  return {lineItemUrl, scoreGiven: prize.points ?? 0}
}
