// mqtt/auth.js
import crypto from "crypto";
import { supabase } from "../lib/supabase.js";

export async function verifyMQTT(username, password) {
  const { data: device } = await supabase
    .from("devices")
    .select("*")
    .eq("device_id", username)
    .single();

  if (!device) return false;

  const hash = crypto.createHash("sha256").update(password).digest("hex");

  return hash === device.mqtt_credential_hash;
}
