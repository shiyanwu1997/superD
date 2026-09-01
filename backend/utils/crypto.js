const crypto = require('crypto');
const { SECURITY_CONFIG } = require('../config');

const IV_LENGTH = 16; // AES块大小为16字节

// 延迟派生密钥，允许启动前的配置校验与测试模块正常加载。
function getEncryptionKey() {
  if (!SECURITY_CONFIG.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY 未配置');
  }
  return crypto.createHash('sha256').update(SECURITY_CONFIG.ENCRYPTION_KEY).digest();
}

/**
 * 加密字符串
 * @param {string} text - 要加密的文本
 * @returns {string} 加密后的文本（Base64编码）
 */
function encrypt(text) {
  if (!text) return '';
  
  try {
    // 生成随机IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // 创建加密器
    const cipher = crypto.createCipheriv('aes-256-cbc', getEncryptionKey(), iv);
    
    // 加密文本
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // 返回IV和加密文本的组合（Base64编码）
    return Buffer.concat([iv, Buffer.from(encrypted, 'base64')]).toString('base64');
  } catch (error) {
    console.error('加密失败:', error);
    throw new Error('加密失败');
  }
}

/**
 * 解密字符串
 * @param {string} encryptedText - 要解密的文本（Base64编码）
 * @returns {string} 解密后的文本
 */
function decrypt(encryptedText) {
  if (!encryptedText) return '';
  
  try {
    // 解码Base64文本
    const encryptedBuffer = Buffer.from(encryptedText, 'base64');
    
    // 提取IV
    const iv = encryptedBuffer.slice(0, IV_LENGTH);
    
    // 提取加密文本
    const encryptedTextBuffer = encryptedBuffer.slice(IV_LENGTH);
    
    // 创建解密器
    const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv);
    
    // 解密文本
    let decrypted = decipher.update(encryptedTextBuffer, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('解密失败:', error);
    throw new Error('解密失败');
  }
}

module.exports = {
  encrypt,
  decrypt
};
