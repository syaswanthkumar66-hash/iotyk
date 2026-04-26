import crypto from "crypto";

// create hash from device_salt (or device_id + salt)
const hash = crypto
  .createHash("sha256")
  .update(factoryDevice.device_salt)
  .digest("hex");

await supabase.from("devices").insert({
  device_id: factoryDevice.device_id,
  device_salt: factoryDevice.device_salt,
  topic_namespace: factoryDevice.namespace,
  user_id: userId,
  mqtt_credential_hash: hash,   // ✅ FIX
  current_state: {},
  status: "offline"
});
