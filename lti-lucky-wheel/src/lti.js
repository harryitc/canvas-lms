// Cac tien ich cho luong LTI 1.3 (OpenID Connect launch).
import crypto from 'node:crypto'
import {SignJWT, jwtVerify as verifyLocal} from 'jose'
import {config} from './config.js'
import {getKeys} from './keys.js'

// Cac claim chuan cua LTI 1.3
export const CLAIM = {
  MESSAGE_TYPE: 'https://purl.imsglobal.org/spec/lti/claim/message_type',
  VERSION: 'https://purl.imsglobal.org/spec/lti/claim/version',
  DEPLOYMENT_ID: 'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
  ROLES: 'https://purl.imsglobal.org/spec/lti/claim/roles',
  CONTEXT: 'https://purl.imsglobal.org/spec/lti/claim/context',
  RESOURCE_LINK: 'https://purl.imsglobal.org/spec/lti/claim/resource_link',
}

// ---- JWKS cua Canvas: tu fetch + cache. Tu verify bang node:crypto thay vi jose,
// vi Canvas dev co the dung khoa RSA < 2048-bit (jose tu choi, crypto thi khong). ----
let _jwksCache = {keys: [], at: 0}
const JWKS_MAX_AGE = 5 * 60 * 1000

async function loadCanvasJwks(force = false) {
  if (!force && _jwksCache.keys.length && Date.now() - _jwksCache.at < JWKS_MAX_AGE) {
    return _jwksCache.keys
  }
  const res = await fetch(config.canvas.jwksUrl)
  if (!res.ok) throw new Error(`Khong lay duoc JWKS tu Canvas (HTTP ${res.status})`)
  const json = await res.json()
  _jwksCache = {keys: json.keys || [], at: Date.now()}
  return _jwksCache.keys
}

async function getCanvasPublicKey(kid) {
  let jwk = (await loadCanvasJwks()).find(k => k.kid === kid)
  if (!jwk) jwk = (await loadCanvasJwks(true)).find(k => k.kid === kid) // refresh neu miss
  if (!jwk) throw new Error(`Khong tim thay khoa kid=${kid} trong JWKS Canvas`)
  return crypto.createPublicKey({key: jwk, format: 'jwk'})
}

function decodeSegment(seg) {
  return JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'))
}

// ---- Quan ly state/nonce trong luong OIDC (luu tam trong RAM) ----
const pending = new Map() // state -> { nonce, expiresAt }
const TTL_MS = 10 * 60 * 1000

export function createLoginState() {
  const state = crypto.randomUUID()
  const nonce = crypto.randomUUID()
  pending.set(state, {nonce, expiresAt: Date.now() + TTL_MS})
  return {state, nonce}
}

export function consumeLoginState(state) {
  const entry = pending.get(state)
  if (!entry) return null
  pending.delete(state)
  if (entry.expiresAt < Date.now()) return null
  return entry
}

// dinh ky don state het han
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of pending) if (v.expiresAt < now) pending.delete(k)
}, 60 * 1000).unref?.()

// Xac thuc id_token tu Canvas gui ve sau khi launch.
export async function verifyIdToken(idToken, expectedNonce) {
  const parts = String(idToken).split('.')
  if (parts.length !== 3) throw new Error('id_token sai dinh dang JWT')
  const [headerB64, payloadB64, sigB64] = parts

  const header = decodeSegment(headerB64)
  if (header.alg !== 'RS256') throw new Error(`alg khong ho tro: ${header.alg}`)

  // Verify chu ky bang node:crypto (khong gioi han do dai khoa).
  const publicKey = await getCanvasPublicKey(header.kid)
  const okSig = crypto.verify(
    'sha256',
    Buffer.from(`${headerB64}.${payloadB64}`),
    {key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING},
    Buffer.from(sigB64, 'base64url'),
  )
  if (!okSig) throw new Error('Chu ky id_token khong hop le')

  const payload = decodeSegment(payloadB64)

  // Kiem tra cac claim chuan (jose von lo viec nay, gio tu lam).
  const now = Math.floor(Date.now() / 1000)
  const skew = 60
  if (payload.iss !== config.canvas.issuer) {
    throw new Error(`iss khong khop: ${payload.iss} (ky vong ${config.canvas.issuer})`)
  }
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!aud.includes(config.clientId)) {
    throw new Error(`aud khong khop client_id (${config.clientId})`)
  }
  if (payload.exp && now > payload.exp + skew) throw new Error('id_token da het han')
  if (payload.nbf && now + skew < payload.nbf) throw new Error('id_token chua hieu luc')

  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error('Nonce khong khop')
  }
  if (payload[CLAIM.MESSAGE_TYPE] !== 'LtiResourceLinkRequest') {
    throw new Error(`message_type khong ho tro: ${payload[CLAIM.MESSAGE_TYPE]}`)
  }
  if (config.deploymentId && payload[CLAIM.DEPLOYMENT_ID] !== config.deploymentId) {
    throw new Error('deployment_id khong khop')
  }
  return payload
}

// ---- Launch token noi bo: ky bang khoa cua tool, gui xuong trinh duyet de
// goi /api/spin ma khong can session/cookie cross-site. ----
export async function signLaunchToken(claims) {
  const {privateKey, alg, publicJwk} = await getKeys()
  return new SignJWT(claims)
    .setProtectedHeader({alg, kid: publicJwk.kid})
    .setIssuedAt()
    .setIssuer(config.toolUrl)
    .setAudience(config.toolUrl)
    .setExpirationTime('30m')
    .sign(privateKey)
}

export async function verifyLaunchToken(token) {
  const {publicKey} = await getKeys()
  // Verify bang khoa cong khai cua tool (RS256).
  const {payload} = await verifyLocal(token, publicKey, {
    issuer: config.toolUrl,
    audience: config.toolUrl,
  })
  return payload
}
