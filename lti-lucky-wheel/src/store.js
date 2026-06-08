// Luu tru ket qua quay cua tung sinh vien vao 1 file JSON don gian.
// Key = "sub" (id nguoi dung on dinh do Canvas cap trong id_token).
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
const FILE = path.join(DATA_DIR, 'spins.json')

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    return {}
  }
}

function writeAll(obj) {
  fs.mkdirSync(DATA_DIR, {recursive: true})
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2))
}

// Lay ket qua da quay cua 1 nguoi (hoac null neu chua quay).
export function getSpin(sub) {
  return readAll()[sub] || null
}

// Ghi ket qua quay. Khong ghi de neu da co (dam bao "moi nguoi 1 lan").
export function saveSpin(sub, record) {
  const all = readAll()
  if (all[sub]) return all[sub]
  all[sub] = record
  writeAll(all)
  return record
}
