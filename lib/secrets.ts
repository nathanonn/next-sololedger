import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "@/lib/env";

/**
 * AES-256-GCM encryption for storing provider API keys
 * Envelope format: { v: 1, iv, ct, tag } (all base64-encoded)
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits
const VERSION = 1;

// Validate and decode encryption key on module init
let encryptionKey: Buffer;

try {
  if (!env.APP_ENCRYPTION_KEY) {
    throw new Error("APP_ENCRYPTION_KEY is not set");
  }

  encryptionKey = Buffer.from(env.APP_ENCRYPTION_KEY, "base64");

  if (encryptionKey.length !== 32) {
    throw new Error(
      `APP_ENCRYPTION_KEY must be 32 bytes (256 bits), got ${encryptionKey.length} bytes. Generate with: openssl rand -base64 32`
    );
  }
} catch (error) {
  if (env.AI_FEATURES_ENABLED) {
    console.error("Failed to initialize encryption key:", error);
    throw error;
  }
  // If AI features are disabled, we don't need the encryption key
  encryptionKey = Buffer.alloc(32); // Placeholder
}

type Envelope = {
  v: number;
  iv: string;
  ct: string;
  tag: string;
};

/**
 * Encrypts a plaintext secret using AES-256-GCM
 * @param plaintext - The secret to encrypt (e.g., API key)
 * @returns Base64-encoded envelope containing version, IV, ciphertext, and auth tag
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty plaintext");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  const envelope: Envelope = {
    v: VERSION,
    iv: iv.toString("base64"),
    ct: encrypted.toString("base64"),
    tag: tag.toString("base64"),
  };

  return Buffer.from(JSON.stringify(envelope)).toString("base64");
}

/**
 * Decrypts an encrypted secret
 * @param ciphertext - Base64-encoded envelope from encryptSecret()
 * @returns Decrypted plaintext secret
 * @throws Error if decryption fails (invalid key, tampered data, etc.)
 */
export function decryptSecret(ciphertext: string): string {
  if (!ciphertext) {
    throw new Error("Cannot decrypt empty ciphertext");
  }

  let envelope: Envelope;

  try {
    const envelopeJson = Buffer.from(ciphertext, "base64").toString("utf8");
    envelope = JSON.parse(envelopeJson) as Envelope;
  } catch (error) {
    throw new Error("Invalid envelope format");
  }

  if (envelope.v !== VERSION) {
    throw new Error(`Unsupported envelope version: ${envelope.v}`);
  }

  if (!envelope.iv || !envelope.ct || !envelope.tag) {
    throw new Error("Envelope missing required fields");
  }

  try {
    const iv = Buffer.from(envelope.iv, "base64");
    const encrypted = Buffer.from(envelope.ct, "base64");
    const tag = Buffer.from(envelope.tag, "base64");

    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: ${iv.length}`);
    }

    if (tag.length !== TAG_LENGTH) {
      throw new Error(`Invalid tag length: ${tag.length}`);
    }

    const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }
}

/**
 * Extracts the last N characters from a plaintext secret for display
 * @param plaintext - The secret to truncate
 * @param length - Number of characters to extract (default: 4)
 * @returns Last N characters of the secret
 */
export function getLastChars(plaintext: string, length: number = 4): string {
  if (!plaintext || plaintext.length < length) {
    return plaintext || "";
  }
  return plaintext.slice(-length);
}
