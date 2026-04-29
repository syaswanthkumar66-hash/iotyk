// routes/pairDevice.js
import crypto from "crypto";
import { supabase } from "../lib/supabase.js";

export async function pairDevice(req, res) {
  const { token } = req.body;
  const user = req.user;

  const hash = crypto.createHash("sha256").update(token).digest("hex");

  // find factory device
  const { data: factory, error } = await supabase
    .from("factory_devices")
    .select("*")
    .eq("device_token_hash", hash)
    .eq("paired", false)
    .single();

  if (error || !factory) {
    return res.status(400).json({ error: "Invalid token" });
  }

  // create device credentials
  const deviceSalt = crypto.randomBytes(16).toString("hex");

  const mqttPassword = crypto.randomBytes(32).toString("hex");
  const mqttHash = crypto.createHash("sha256").update(mqttPassword).digest("hex");

  const wssKey = crypto.randomBytes(32).toString("hex");
  const wssHash = crypto.createHash("sha256").update(wssKey).digest("hex");

  // insert into devices
  const { data: device } = await supabase
    .from("devices")
    .insert({
      device_id: factory.device_id,
      user_id: user.id,
      device_salt: deviceSalt,
      mqtt_credential_hash: mqttHash,
      wss_key_hash: wssHash,
      topic_namespace: "iotyk",
    })
    .select()
    .single();

  // mark factory paired
  await supabase
    .from("factory_devices")
    .update({
      paired: true,
      paired_at: new Date(),
    })
    .eq("device_id", factory.device_id);

  res.json({
    success: true,
    mqtt: {
      username: device.device_id,
      password: mqttPassword,
    },
    wss_key: wssKey,
  });
}
