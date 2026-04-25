// utils/crypto.js
import crypto from "crypto";

export function buildNamespace(device_id) {
  return crypto
    .createHmac("sha256", process.env.TOPIC_SECRET)
    .update(device_id)
    .digest("hex")
    .substring(0, 32);
}
