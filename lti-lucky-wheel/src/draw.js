import crypto from 'node:crypto'
import {PRIZES} from './config.js'

// Chon ngau nhien 1 phan qua theo trong so (weight). May chu quyet dinh ket qua
// de tranh gian lan phia client va dam bao cong bang.
export function drawPrize() {
  const total = PRIZES.reduce((s, p) => s + (p.weight || 1), 0)
  // crypto.randomInt cho phan phoi deu, khong bias.
  let r = crypto.randomInt(total)
  for (let i = 0; i < PRIZES.length; i++) {
    r -= PRIZES[i].weight || 1
    if (r < 0) return {index: i, prize: PRIZES[i]}
  }
  return {index: PRIZES.length - 1, prize: PRIZES[PRIZES.length - 1]}
}
