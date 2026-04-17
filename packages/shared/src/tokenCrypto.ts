import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export interface EncryptedToken {
  ciphertext: string;
  iv: string;
  tag: string;
}

export const parseTokenEncryptionKey = (base64Key: string): Buffer => {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }

  return key;
};

export const encryptToken = (plainToken: string, key: Buffer): EncryptedToken => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plainToken, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
};

export const decryptToken = (encryptedToken: EncryptedToken, key: Buffer): string => {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(encryptedToken.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encryptedToken.tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedToken.ciphertext, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};
