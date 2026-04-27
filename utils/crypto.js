import crypto from "crypto";

// SHA256
export function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// Generate random token
export function generateToken(length = 32) {
  return crypto.randomBytes(length).toString("hex");
}
