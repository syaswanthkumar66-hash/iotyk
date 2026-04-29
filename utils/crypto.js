import crypto from "crypto";

export function generateToken(len = 16) {
  return crypto.randomBytes(len).toString("hex");
}

export function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}
