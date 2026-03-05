import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex')

if (process.env.ENCRYPTION_KEY && KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return ''
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // store as iv:tag:ciphertext (all hex)
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ''
  try {
    const [ivHex, tagHex, dataHex] = ciphertext.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    const data = Buffer.from(dataHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
    decipher.setAuthTag(tag)
    return decipher.update(data) + decipher.final('utf8')
  } catch {
    return ''
  }
}
