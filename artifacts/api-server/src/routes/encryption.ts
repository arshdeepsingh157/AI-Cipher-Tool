import { Router } from "express";
import { db } from "@workspace/db";
import { encryptionHistoryTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { EncryptTextBody, DecryptTextBody, GenerateKeyBody } from "@workspace/api-zod";
import crypto from "crypto";

const router = Router();

function caesarEncrypt(text: string, shift: number): string {
  return text.replace(/[a-zA-Z]/g, (char) => {
    const base = char >= "a" ? "a".charCodeAt(0) : "A".charCodeAt(0);
    return String.fromCharCode(((char.charCodeAt(0) - base + shift) % 26) + base);
  });
}

function caesarDecrypt(text: string, shift: number): string {
  return caesarEncrypt(text, 26 - (shift % 26));
}

function rot13(text: string): string {
  return caesarEncrypt(text, 13);
}

function vigenereEncrypt(text: string, key: string): string {
  const k = key.toUpperCase().replace(/[^A-Z]/g, "");
  if (!k.length) return text;
  let result = "";
  let ki = 0;
  for (const char of text) {
    if (/[a-zA-Z]/.test(char)) {
      const base = char >= "a" ? "a".charCodeAt(0) : "A".charCodeAt(0);
      const shift = k[ki % k.length].charCodeAt(0) - "A".charCodeAt(0);
      result += String.fromCharCode(((char.charCodeAt(0) - base + shift) % 26) + base);
      ki++;
    } else {
      result += char;
    }
  }
  return result;
}

function vigenereDecrypt(text: string, key: string): string {
  const k = key.toUpperCase().replace(/[^A-Z]/g, "");
  if (!k.length) return text;
  let result = "";
  let ki = 0;
  for (const char of text) {
    if (/[a-zA-Z]/.test(char)) {
      const base = char >= "a" ? "a".charCodeAt(0) : "A".charCodeAt(0);
      const shift = k[ki % k.length].charCodeAt(0) - "A".charCodeAt(0);
      result += String.fromCharCode(((char.charCodeAt(0) - base - shift + 26) % 26) + base);
      ki++;
    } else {
      result += char;
    }
  }
  return result;
}

function xorEncrypt(text: string, key: string): string {
  const keyBytes = Buffer.from(key || "defaultkey", "utf8");
  const textBytes = Buffer.from(text, "utf8");
  const result = Buffer.alloc(textBytes.length);
  for (let i = 0; i < textBytes.length; i++) {
    result[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return result.toString("hex");
}

function xorDecrypt(hexText: string, key: string): string {
  const keyBytes = Buffer.from(key || "defaultkey", "utf8");
  const textBytes = Buffer.from(hexText, "hex");
  const result = Buffer.alloc(textBytes.length);
  for (let i = 0; i < textBytes.length; i++) {
    result[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return result.toString("utf8");
}

function aesEncrypt(text: string, key: string): string {
  const keyBuffer = crypto.createHash("sha256").update(key || "defaultkey").digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", keyBuffer, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function aesDecrypt(text: string, key: string): string {
  const parts = text.split(":");
  if (parts.length !== 2) throw new Error("Invalid AES encrypted format");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const keyBuffer = crypto.createHash("sha256").update(key || "defaultkey").digest();
  const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuffer, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

router.post("/encrypt", async (req, res) => {
  try {
    const parsed = EncryptTextBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const { text, algorithm, key, shift } = parsed.data;
    const startTime = Date.now();
    let encrypted = "";

    switch (algorithm) {
      case "AES":
        encrypted = aesEncrypt(text, key || "defaultkey");
        break;
      case "Caesar":
        encrypted = caesarEncrypt(text, shift ?? 3);
        break;
      case "Base64":
        encrypted = Buffer.from(text, "utf8").toString("base64");
        break;
      case "ROT13":
        encrypted = rot13(text);
        break;
      case "Vigenere":
        encrypted = vigenereEncrypt(text, key || "KEY");
        break;
      case "XOR":
        encrypted = xorEncrypt(text, key || "defaultkey");
        break;
      default:
        res.status(400).json({ error: "Unknown algorithm" });
        return;
    }

    const processingTime = Date.now() - startTime;

    await db.insert(encryptionHistoryTable).values({
      operation: "encrypt",
      algorithm,
      inputLength: text.length,
      outputLength: encrypted.length,
      processingTime,
    });

    res.json({ encrypted, algorithm, key: key ?? null, processingTime });
  } catch (err) {
    req.log.error({ err }, "Failed to encrypt");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/decrypt", async (req, res) => {
  try {
    const parsed = DecryptTextBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const { text, algorithm, key, shift } = parsed.data;
    const startTime = Date.now();
    let decrypted = "";

    switch (algorithm) {
      case "AES":
        decrypted = aesDecrypt(text, key || "defaultkey");
        break;
      case "Caesar":
        decrypted = caesarDecrypt(text, shift ?? 3);
        break;
      case "Base64":
        decrypted = Buffer.from(text, "base64").toString("utf8");
        break;
      case "ROT13":
        decrypted = rot13(text);
        break;
      case "Vigenere":
        decrypted = vigenereDecrypt(text, key || "KEY");
        break;
      case "XOR":
        decrypted = xorDecrypt(text, key || "defaultkey");
        break;
      default:
        res.status(400).json({ error: "Unknown algorithm" });
        return;
    }

    const processingTime = Date.now() - startTime;

    await db.insert(encryptionHistoryTable).values({
      operation: "decrypt",
      algorithm,
      inputLength: text.length,
      outputLength: decrypted.length,
      processingTime,
    });

    res.json({ decrypted, algorithm, processingTime });
  } catch (err) {
    req.log.error({ err }, "Failed to decrypt");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/generate-key", async (req, res) => {
  try {
    const parsed = GenerateKeyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const { algorithm } = parsed.data;
    let key = "";
    let description = "";

    switch (algorithm) {
      case "AES":
        key = crypto.randomBytes(32).toString("hex");
        description = "256-bit random key for AES encryption (keep this secret!)";
        break;
      case "Caesar":
        key = String(Math.floor(Math.random() * 25) + 1);
        description = "Shift value (1-25) for Caesar cipher";
        break;
      case "Base64":
        key = "No key needed";
        description = "Base64 encoding does not require a key";
        break;
      case "ROT13":
        key = "13";
        description = "ROT13 always uses a fixed shift of 13";
        break;
      case "Vigenere":
        key = crypto.randomBytes(8).toString("hex").toUpperCase().replace(/[^A-Z]/g, "X").slice(0, 10);
        description = "Alphabetic keyword for Vigenere cipher";
        break;
      case "XOR":
        key = crypto.randomBytes(16).toString("hex");
        description = "Random key for XOR cipher";
        break;
      default:
        res.status(400).json({ error: "Unknown algorithm" });
        return;
    }

    res.json({ key, algorithm, description });
  } catch (err) {
    req.log.error({ err }, "Failed to generate key");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const history = await db.select().from(encryptionHistoryTable).orderBy(desc(encryptionHistoryTable.createdAt)).limit(50);
    res.json(history);
  } catch (err) {
    req.log.error({ err }, "Failed to get history");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const history = await db.select().from(encryptionHistoryTable);

    const totalOperations = history.length;
    const encryptCount = history.filter((h) => h.operation === "encrypt").length;
    const decryptCount = history.filter((h) => h.operation === "decrypt").length;

    const algoCounts: Record<string, number> = {};
    for (const h of history) {
      algoCounts[h.algorithm] = (algoCounts[h.algorithm] || 0) + 1;
    }
    const mostUsedAlgorithm = Object.entries(algoCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "AES";

    const averageProcessingTime = totalOperations > 0
      ? history.reduce((sum, h) => sum + h.processingTime, 0) / totalOperations
      : 0;

    res.json({ totalOperations, encryptCount, decryptCount, mostUsedAlgorithm, averageProcessingTime });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
