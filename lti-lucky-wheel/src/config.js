import 'dotenv/config'

export const config = {
  port: Number(process.env.PORT || 4000),
  toolUrl: (process.env.TOOL_URL || 'http://localhost:4000').replace(/\/$/, ''),

  canvas: {
    issuer: process.env.CANVAS_ISSUER || 'https://canvas.instructure.com',
    authUrl:
      process.env.CANVAS_AUTH_URL || 'https://canvas.instructure.com/api/lti/authorize_redirect',
    jwksUrl: process.env.CANVAS_JWKS_URL || 'https://canvas.instructure.com/api/lti/security/jwks',
    tokenUrl: process.env.CANVAS_TOKEN_URL || 'https://canvas.instructure.com/login/oauth2/token',
  },

  clientId: process.env.CLIENT_ID || '',
  deploymentId: process.env.DEPLOYMENT_ID || '',
}

// Cac duong dan tien ich, suy ra tu toolUrl
export const urls = {
  login: `${config.toolUrl}/login`,
  launch: `${config.toolUrl}/launch`,
  jwks: `${config.toolUrl}/jwks`,
  config: `${config.toolUrl}/config`,
}

// Danh sach phan qua tren vong quay.
// weight = trong so (cang lon cang de trung). Mau de ve vong quay.
// points = diem thuong se ghi vao so diem Canvas (tren thang AGS_MAX).
export const PRIZES = [
  {id: 'voucher50', label: 'Voucher 50k', color: '#e74c3c', weight: 2, points: 50},
  {id: 'plus1', label: '+1 diem cong', color: '#f39c12', weight: 3, points: 10},
  {id: 'sticker', label: 'Sticker doc quyen', color: '#27ae60', weight: 3, points: 30},
  {id: 'coffee', label: '1 ly cafe mien phi', color: '#2980b9', weight: 2, points: 40},
  {id: 'goodluck', label: 'Chuc may man lan sau', color: '#8e44ad', weight: 4, points: 0},
  {id: 'jackpot', label: 'JACKPOT - Qua dac biet', color: '#16a085', weight: 1, points: 100},
]

// Thang diem toi da cua line item tren Canvas.
export const AGS_MAX = 100

// Cac scope LTI Advantage (AGS) ma tool xin khi goi nguoc Canvas.
export const AGS_SCOPES = {
  LINEITEM: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  SCORE: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  RESULT: 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
}

// Cac claim LTI lien quan AGS trong id_token
export const AGS_CLAIM = {
  ENDPOINT: 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint',
}
