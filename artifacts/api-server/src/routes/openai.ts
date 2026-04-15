import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SendOpenaiMessageBody, CreateOpenaiConversationBody } from "@workspace/api-zod";

// ---------------------------------------------------------------------------
// Predefined Q&A knowledge base
// ---------------------------------------------------------------------------
const QA: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["difference between aes and rsa", "aes and rsa", "aes vs rsa"],
    answer: `AES vs RSA — Key Differences

AES (Advanced Encryption Standard)
• Type: Symmetric — same key encrypts and decrypts
• Speed: Very fast, ideal for large data
• Key sizes: 128, 192, or 256 bits
• Use cases: File encryption, disk encryption, TLS data channel
• Example: Encrypting a 1 GB video file takes milliseconds

RSA (Rivest–Shamir–Adleman)
• Type: Asymmetric — public key encrypts, private key decrypts
• Speed: ~1000× slower than AES
• Key sizes: 2048, 3072, or 4096 bits
• Use cases: Key exchange, digital signatures, TLS handshake
• Example: Securely delivering an AES session key

In Practice — Hybrid Encryption
AES and RSA are almost always used together:
1. Generate a random AES-256 key
2. Encrypt your data with AES (fast)
3. Encrypt the AES key with RSA (secure key delivery)
This is exactly how HTTPS works.`,
  },
  {
    keywords: ["aes-256", "cbc mode", "how does aes", "aes work"],
    answer: `How AES-256 Works in CBC Mode

AES (Advanced Encryption Standard) is a block cipher — it processes data in fixed 128-bit (16-byte) blocks.

Key Setup
• Your passphrase is hashed into a 256-bit (32-byte) key
• An 11-round key schedule expands this into 11 round keys

Each Round Applies 4 Operations
1. SubBytes — each byte replaced via a lookup table (S-box)
2. ShiftRows — rows of the 4×4 state matrix are rotated
3. MixColumns — columns multiplied in Galois Field (diffusion)
4. AddRoundKey — XOR with the round key

CBC (Cipher Block Chaining) Mode
• Each plaintext block is XOR'd with the previous ciphertext block before encryption
• The first block uses a random Initialization Vector (IV)
• Result: identical plaintext blocks produce different ciphertext
• The IV must be stored alongside the ciphertext (it is not secret)

Security
AES-256 CBC is considered secure. No practical attack exists against the cipher itself. Vulnerabilities typically come from poor key management or padding oracle attacks — not the algorithm.`,
  },
  {
    keywords: ["vigenere", "kasiski", "vulnerable", "polyalphabetic"],
    answer: `Why the Vigenère Cipher Falls to Kasiski Examination

The Vigenère cipher uses a repeating keyword to shift each letter. For example, with key "KEY":
  Plaintext:  HELLOWORLD
  Key repeat: KEYKEYKEYK
  Ciphertext: RIJVSYYVVN

The Fatal Weakness — Key Repetition
Because the key repeats, the same plaintext trigram encrypted under the same key position produces the same ciphertext trigram.

Kasiski Examination (1863)
1. Scan the ciphertext for repeated sequences of 3+ characters
2. Measure the distances between repetitions
3. The key length is likely a common factor (GCD) of those distances
4. Once key length L is found, split ciphertext into L groups
5. Each group is a simple Caesar cipher — broken instantly by frequency analysis

Example
If "XQJ" appears at positions 10 and 34, the distance is 24. Key length divides 24, so it's likely 2, 3, 4, 6, 8, or 12.

Modern Resistance
Longer keys reduce repetition but never eliminate it entirely. Only a key as long as the message (one-time pad) is immune.`,
  },
  {
    keywords: ["public key cryptography", "asymmetric", "real-world analogy", "public key"],
    answer: `Public Key Cryptography — A Real-World Analogy

Think of a padlock and key:

The Setup
• Alice manufactures padlocks and gives copies to everyone (public key)
• Only Alice has the key that opens them (private key)

Sending a Secret Message to Alice
1. Bob puts his message in a box
2. Bob snaps Alice's padlock shut on the box
3. Bob sends the locked box publicly — anyone can see it
4. Only Alice can open it (she's the only one with the key)

That's RSA/public-key encryption in a nutshell.

Digital Signatures (Reversed)
• Alice locks a box with her private key
• Anyone with Alice's public key can open it
• If it opens → the message must have come from Alice
This is how code signing and document authenticity work.

Math Behind It
Public-key cryptography relies on mathematical trapdoor functions:
• RSA: factoring large numbers (easy to multiply, hard to factor)
• ECC: elliptic curve discrete logarithm
• These are "one-way" — easy one direction, computationally infeasible to reverse

Real Usage
Every time you see 🔒 in your browser, your computer used public-key crypto to agree on a shared AES session key with the server.`,
  },
  {
    keywords: ["one-time pad", "otp", "theoretically unbreakable", "perfectly secret"],
    answer: `The One-Time Pad — Why It's Theoretically Unbreakable

A one-time pad (OTP) is the only encryption scheme proven to be perfectly secret by Claude Shannon (1949).

How It Works
1. Generate a truly random key the same length as the message
2. XOR (or add mod 26) each character of the plaintext with the key
3. The result is the ciphertext

Example
  Plaintext:  HELLO  (72 69 76 76 79 in ASCII)
  Key:        XMCKL  (88 77 67 75 76)
  Ciphertext: XOR →  (16 12 11 03 05)

Why It's Unbreakable
For any ciphertext, every possible plaintext of that length is equally likely. An attacker with infinite computing power STILL cannot determine the original message — the math guarantees it.

The Catch — Three Strict Requirements
1. The key must be truly random (not pseudorandom)
2. The key must be exactly as long as the message
3. The key must NEVER be reused (hence "one-time")

Break any rule and security collapses instantly.

Why We Don't Use It
• Key distribution is as hard as the original problem
• Keys are huge — a 1 GB file needs a 1 GB key
• Modern algorithms like AES-256 are computationally secure and practical`,
  },
  {
    keywords: ["salted hash", "salt", "password", "rainbow table"],
    answer: `How Salted Hashes Protect Passwords

Never store passwords in plaintext. But even hashed passwords have weaknesses without salting.

The Problem With Plain Hashes
SHA-256("password123") always equals the same value. An attacker can precompute a rainbow table — a massive lookup of hash → plaintext for millions of common passwords. One DB breach exposes everyone.

What Is a Salt?
A salt is a random string (16–32 bytes) generated uniquely per user and stored alongside the hash.

Salted Hash Process
1. User sets password: "password123"
2. Generate random salt: "a8f3c2..."
3. Compute: hash = SHA-256("a8f3c2..." + "password123")
4. Store: (username, salt, hash) in database

Why It Works
• Two users with the same password get different hashes (different salts)
• Rainbow tables become useless — attacker must brute-force each account individually
• Even if the DB is stolen, cracking is expensive per account

Modern Best Practice
Don't use plain SHA-256 for passwords. Use purpose-built slow algorithms:
• bcrypt — built-in salting, configurable work factor
• Argon2 — winner of Password Hashing Competition (2015), recommended today
• scrypt — memory-hard, resistant to GPU attacks

These are slow by design — taking ~100ms per hash — making brute force attacks impractical.`,
  },
  {
    keywords: ["xor cipher", "xor encryption", "xor"],
    answer: `XOR Cipher — How It Works

XOR (exclusive OR) is the simplest symmetric cipher. It's the building block of nearly every modern encryption algorithm.

The Operation
XOR produces 1 if bits differ, 0 if they're the same:
  0 XOR 0 = 0
  0 XOR 1 = 1
  1 XOR 0 = 1
  1 XOR 1 = 0

Encryption
  Plaintext byte:    01001000  (H)
  Key byte:          10110011
  Ciphertext byte:   11111011  (XOR result)

Decryption — Apply XOR Again
  Ciphertext byte:   11111011
  Key byte:          10110011
  Plaintext byte:    01001000  (H restored)

XOR is its own inverse. That's what makes it elegant.

Security
• With a short repeating key: VERY WEAK — broken by frequency analysis (same as Vigenère)
• With a key = message length (true one-time pad): PERFECTLY SECURE
• Key must never be reused — reusing XOR keys is catastrophic

Real-World Usage
XOR is used inside AES (AddRoundKey step), stream ciphers, and RAID 5 parity. The raw XOR cipher alone is only suitable for educational purposes.`,
  },
  {
    keywords: ["caesar cipher", "shift cipher", "rot", "brute force cipher"],
    answer: `The Caesar Cipher

Julius Caesar used this cipher to communicate with his generals around 58 BC. Each letter is shifted a fixed number of positions in the alphabet.

With a shift of 3:
  A → D,  B → E,  C → F, ...  Z → C
  HELLO → KHOOR

To decrypt, shift back by 3.

Security — Essentially None
The key space is tiny: only 25 possible shifts (shift of 0 = no change, shift of 26 = full rotation). An attacker can try all 25 options in seconds — or milliseconds on a computer.

Breaking It
Method 1 — Brute Force: Try all 25 shifts, read the one that makes sense.
Method 2 — Frequency Analysis: In English, 'E' is most common (~13%). Find the most frequent letter in the ciphertext — that's likely 'E'. Calculate the shift.

Variants
• ROT13: Caesar with fixed shift of 13. Used for spoiler hiding. Applying it twice restores the original (13+13=26).
• Atbash: A=Z, B=Y substitution (used in the Hebrew Bible)

Modern Relevance
The Caesar cipher exists purely for education. It demonstrates the core concept of substitution and why a tiny key space is catastrophic. Real encryption needs a key space of 2^128 or larger.`,
  },
  {
    keywords: ["base64", "encoding", "binary to text"],
    answer: `Base64 Encoding — Not Encryption

Base64 is a binary-to-text encoding scheme. It is NOT encryption — there is no key, and anyone can decode it instantly.

Why It Exists
Many systems (email, URLs, HTML) were designed for ASCII text and can't safely transmit raw binary bytes. Base64 converts any binary data to a safe subset of 64 printable ASCII characters: A-Z, a-z, 0-9, +, /

How It Works
1. Take 3 bytes (24 bits) of input
2. Split into four 6-bit groups
3. Map each 6-bit value to one of 64 characters
4. Pad with = if input isn't a multiple of 3 bytes

Example
  Input:    "Hi!" → bytes: 72 105 33
  Binary:   01001000 01101001 00100001
  6-bit:    010010 000110 100100 100001
  Base64:   S  i  k  h  → "SGkh"

Size Overhead
Base64 output is ~33% larger than the input (4 output chars per 3 input bytes).

Common Uses
• Email attachments (MIME)
• Embedding images in HTML/CSS (data: URIs)
• JWT tokens
• Encoding binary data in JSON APIs

Never use Base64 to "secure" sensitive data — it's trivially reversible by design.`,
  },
];

function findAnswer(question: string): string {
  const q = question.toLowerCase();
  for (const entry of QA) {
    if (entry.keywords.some((kw) => q.includes(kw))) {
      return entry.answer;
    }
  }
  return `I'm a predefined cryptography assistant. I can answer questions about:

• AES vs RSA encryption differences
• How AES-256 works in CBC mode
• Vigenère cipher and Kasiski examination
• Public key cryptography explained
• One-time pad and perfect secrecy
• Salted hashes and password protection
• XOR cipher mechanics
• Caesar cipher and ROT13
• Base64 encoding

Try clicking one of the suggested questions, or rephrase your question using one of those topics.`;
}

async function streamAnswer(res: import("express").Response, answer: string): Promise<void> {
  const words = answer.split(" ");
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? "" : " ") + words[i];
    res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    await new Promise((r) => setTimeout(r, 18));
  }
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
}

const router = Router();

router.get("/conversations", async (req, res) => {
  try {
    const all = await db.select().from(conversations).orderBy(conversations.createdAt);
    res.json(all);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const parsed = CreateOpenaiConversationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const [conv] = await db.insert(conversations).values({ title: parsed.data.title }).returning();
    res.status(201).json(conv);
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
    res.json({ ...conv, messages: msgs });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await db.delete(conversations).where(eq(conversations.id, id)).returning();
    if (!deleted.length) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
    res.json(msgs);
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = SendOpenaiMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    await db.insert(messages).values({ conversationId: id, role: "user", content: parsed.data.content });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const answer = findAnswer(parsed.data.content);

    await streamAnswer(res, answer);

    await db.insert(messages).values({ conversationId: id, role: "assistant", content: answer });
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

export default router;
