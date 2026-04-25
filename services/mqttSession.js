// services/mqttSession.js
import { supabase } from "./supabase.js";
import { createUser, createACL } from "./emqxCloud.js";
import crypto from "crypto";
import { buildNamespace } from "../utils/crypto.js";

export async function createMQTTSession(user_id, device_id) {

  // 🔐 Check access (STRICT)
  const { data: access, error } = await supabase
    .from("device_access")
    .select("role")
    .eq("user_id", user_id)
    .eq("device_id", device_id)
    .single();

  if (!access) throw new Error("Access denied");

  const role = access.role;

  // 🔑 Generate credentials
  const username = "u_" + crypto.randomUUID();
  const password = crypto.randomBytes(32).toString("hex");

  const namespace = buildNamespace(device_id);

  // 📡 EMQX Cloud
  await createUser(username, password);
  await createACL(username, namespace, role);

  // 💾 Store session
  await supabase.from("mqtt_sessions").insert({
    user_id,
    device_id,
    username,
    password_hash: crypto
      .createHash("sha256")
      .update(password)
      .digest("hex"),
    expires_at: new Date(Date.now() + 60 * 60 * 1000)
  });

  return {
    username,
    password,
    namespace,
    broker: process.env.MQTT_HOST
  };
}
