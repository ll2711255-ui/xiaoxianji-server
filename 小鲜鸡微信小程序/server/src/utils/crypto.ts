import crypto from 'crypto';

/** HMAC-SHA256 */
export function hmacSha256(key: string, data: string): string {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/** MD5 */
export function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

/** RSA-SHA256 签名 */
export function rsaSign(privateKey: string, data: string): string {
  return crypto.createSign('RSA-SHA256').update(data).sign(privateKey, 'base64');
}

/** RSA-SHA256 验签 */
export function rsaVerify(publicKey: string, data: string, signature: string): boolean {
  return crypto.createVerify('RSA-SHA256').update(data).verify(publicKey, signature, 'base64');
}

/** AEAD_AES_256_GCM 解密 */
export function aesGcmDecrypt(key: string, nonce: string, associatedData: string, ciphertext: string): string {
  const ciphertextBuf = Buffer.from(ciphertext, 'base64');
  const authTag = ciphertextBuf.slice(ciphertextBuf.length - 16);
  const data = ciphertextBuf.slice(0, ciphertextBuf.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(nonce, 'utf8'));
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(associatedData, 'utf8'));

  return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
}

/** 生成随机字符串 */
export function randomStr(len = 16): string {
  return crypto.randomBytes(len).toString('hex');
}

/** RSA-SHA256 签名（用于 APIv3 回调验签） */
export function rsaSha256Verify(publicKey: string, message: string, signature: string): boolean {
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(message);
  return verify.verify(publicKey, signature, 'base64');
}
