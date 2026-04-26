import crypto from "crypto";

export function hashCredential(input) {
  return crypto
    .createHash("sha256")
    .update(input)
    .digest("hex");
}
