import crypto from 'crypto';

// Ensure your ENCRYPTION_KEY is a 32-byte (64 hex characters) string in your .env file.
// The ENCRYPTION_IV from your .env file will NOT be used directly for AES-GCM encryption
// as GCM requires a unique IV for every encryption operation with the same key for security.
// We will generate a random IV for each encryption and prepend it to the ciphertext.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard IV length is 12 bytes
const AUTH_TAG_LENGTH = 16; // GCM standard auth tag length is 16 bytes

/**
 * Encrypts a text string using AES-256-GCM.
 * A new random IV is generated for each encryption and prepended to the ciphertext.
 * The authentication tag is appended to the ciphertext.
 * @param {string} text The plaintext to encrypt.
 * @returns {string} Hex-encoded string: IV + Ciphertext + AuthTag.
 * @throws {Error} If ENCRYPTION_KEY is not set or is invalid.
 */
export function encrypt(text) {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error('ENCRYPTION_KEY is not set in environment variables.');
    throw new Error('Encryption key error: Key not configured.');
  }
  if (Buffer.from(encryptionKey, 'hex').length !== 32) {
    console.error('ENCRYPTION_KEY is not a 32-byte hex string.');
    throw new Error('Encryption key error: Key must be 32 bytes (64 hex characters).');
  }

  const key = Buffer.from(encryptionKey, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Return IV + Ciphertext + AuthTag, all hex encoded
  return iv.toString('hex') + encrypted + authTag.toString('hex');
}

/**
 * Decrypts a hex-encoded string (IV + Ciphertext + AuthTag) using AES-256-GCM.
 * @param {string} encryptedDataHex Hex-encoded string containing IV, ciphertext, and auth tag.
 * @returns {string} The decrypted plaintext.
 * @throws {Error} If ENCRYPTION_KEY is not set, is invalid, or if decryption fails (e.g., tampered data).
 */
export function decrypt(encryptedDataHex) {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error('ENCRYPTION_KEY is not set in environment variables.');
    throw new Error('Decryption key error: Key not configured.');
  }
  if (Buffer.from(encryptionKey, 'hex').length !== 32) {
    console.error('ENCRYPTION_KEY is not a 32-byte hex string.');
    throw new Error('Decryption key error: Key must be 32 bytes (64 hex characters).');
  }
  const key = Buffer.from(encryptionKey, 'hex');

  const ivHexLength = IV_LENGTH * 2; // Each byte is 2 hex characters
  const authTagHexLength = AUTH_TAG_LENGTH * 2;

  if (typeof encryptedDataHex !== 'string' || encryptedDataHex.length < ivHexLength + authTagHexLength) {
    throw new Error('Invalid encrypted data format: Input must be a string and sufficiently long.');
  }

  const iv = Buffer.from(encryptedDataHex.substring(0, ivHexLength), 'hex');
  const authTag = Buffer.from(encryptedDataHex.substring(encryptedDataHex.length - authTagHexLength), 'hex');
  const encryptedText = encryptedDataHex.substring(ivHexLength, encryptedDataHex.length - authTagHexLength);

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid encrypted data format: Extracted IV length is incorrect.');
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted data format: Extracted auth tag length is incorrect.');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = '';
  try {
    decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
  } catch (error) {
    console.error('Decryption failed. This could be due to tampered data or an incorrect key/IV.', error);
    throw new Error('Decryption failed: Data integrity check failed or invalid key.');
  }

  return decrypted;
}

/**
 * Securely encrypts an object by serializing it to JSON, encrypting the string,
 * and then returning the hex-encoded encrypted string.
 * @param {object} dataObject The object to encrypt.
 * @returns {string} Hex-encoded encrypted JSON string.
 * @throws {Error} If object serialization or encryption fails.
 */
export function encryptObject(dataObject) {
  try {
    const jsonString = JSON.stringify(dataObject);
    return encrypt(jsonString);
  } catch (error) {
    console.error('Error during object encryption:', error);
    // Check if JSON.stringify failed
    if (error instanceof TypeError && error.message.includes('circular structure')) {
        throw new Error('Failed to encrypt object: Circular structure in object.');
    }
    throw new Error('Failed to encrypt object.');
  }
}

/**
 * Securely decrypts a hex-encoded encrypted JSON string back into an object.
 * @param {string} encryptedDataHex Hex-encoded encrypted JSON string.
 * @returns {object} The decrypted object.
 * @throws {Error} If decryption or JSON parsing fails.
 */
export function decryptObject(encryptedDataHex) {
  try {
    const decryptedJsonString = decrypt(encryptedDataHex);
    return JSON.parse(decryptedJsonString);
  } catch (error) {
    console.error('Error during object decryption:', error);
    if (error.message.includes('Decryption failed')) { // Check if it's a decryption error from our decrypt function
        throw error; // Re-throw the specific decryption error
    } else if (error instanceof SyntaxError) { // Check if it's a JSON parsing error
        throw new Error('Failed to parse decrypted object: Invalid JSON format.');
    }
    throw new Error('Failed to decrypt or parse object.');
  }
} 