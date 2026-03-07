import crypto from "crypto";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getSecretKey() {
  const raw = process.env.LLM_CONFIG_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!raw) {
    throw new Error("Missing LLM_CONFIG_SECRET (or NEXTAUTH_SECRET fallback)");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", getSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string) {
  const [ivRaw, authTagRaw, encryptedRaw] = payload.split(".");
  if (!ivRaw || !authTagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted payload");
  }

  const iv = Buffer.from(ivRaw, "base64");
  const authTag = Buffer.from(authTagRaw, "base64");
  const encrypted = Buffer.from(encryptedRaw, "base64");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted payload format");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", getSecretKey(), iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString("utf8");
}

export function maskSecret(secret: string) {
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return "********";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}
