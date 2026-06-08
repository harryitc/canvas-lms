// Quan ly cap khoa RSA cua tool (dung de ky launch-token noi bo va expose JWKS
// cho Canvas neu can goi nguoc lai cac dich vu LTI Advantage).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {generateKeyPair, exportPKCS8, importPKCS8, exportJWK, calculateJwkThumbprint} from 'jose'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const KEYS_DIR = path.join(__dirname, '..', 'keys')
const PRIV_PATH = path.join(KEYS_DIR, 'private.pem')
const ALG = 'RS256'

let _state = null

// Tao moi (lan dau) hoac nap lai (cac lan sau) cap khoa, luu PEM ra file de on dinh.
export async function getKeys() {
  if (_state) return _state

  fs.mkdirSync(KEYS_DIR, {recursive: true})

  let privateKey
  if (fs.existsSync(PRIV_PATH)) {
    privateKey = await importPKCS8(fs.readFileSync(PRIV_PATH, 'utf8'), ALG)
  } else {
    const pair = await generateKeyPair(ALG, {extractable: true})
    privateKey = pair.privateKey
    fs.writeFileSync(PRIV_PATH, await exportPKCS8(privateKey), {mode: 0o600})
  }

  // JWK cong khai + kid (thumbprint) de bo vao JWKS.
  const publicJwk = await exportJWK(privateKey)
  delete publicJwk.d
  delete publicJwk.p
  delete publicJwk.q
  delete publicJwk.dp
  delete publicJwk.dq
  delete publicJwk.qi
  publicJwk.use = 'sig'
  publicJwk.alg = ALG
  publicJwk.kid = await calculateJwkThumbprint(publicJwk)

  // Khoa cong khai (KeyObject) suy ra tu private, dung de verify launch-token.
  const publicKey = crypto.createPublicKey(privateKey)

  _state = {privateKey, publicKey, publicJwk, alg: ALG}
  return _state
}
