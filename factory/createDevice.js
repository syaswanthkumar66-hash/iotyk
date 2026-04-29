// factory/createDevice.js
import crypto from "crypto";
import { supabase } from "../lib/supabase.js";

export async function createDevice(device_id) {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");

  const { data, error } = await supabase
    .from("factory_devices")
    .insert({
      device_id,
      namespace: "iotyk",
      device_token_hash: hash,
      device_token: token, // ⚠️ optional (remove in production)
    })
    .select()
    .single();

  if (error) throw error;

  return {
    device_id,
    token, // give this to user
  };
}
