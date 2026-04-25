import crypto from "crypto";
import { supabase } from "./supabase.js";
import fetch from "node-fetch";

function buildNamespace(device_id) {
  return crypto
    .createHmac("sha256", process.env.TOPIC_SECRET)
    .update(device_id)
    .digest("hex")
    .substring(0, 32);
}

// 🔴 Disconnect existing client (IMPORTANT)
async function disconnectClient(clientId) {
  try {
    await fetch(
      `${process.env.EMQX_BASE_URL}/clients/${clientId}`,
      {
        method: "DELETE",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              process.env.EMQX_API_KEY +
                ":" +
                process.env.EMQX_API_SECRET
            ).toString("base64"),
        },
      }
    );
  } catch (err) {
    console.log("Disconnect failed (ignore if none):", err.message);
  }
}

export async function createMQTTSession(user_id, device_id, ip) {

  // 🔐 Check access
  const { data: access } = await supabase
    .from("device_access")
    .select("role")
    .eq("user_id", user_id)
    .eq("device_id", device_id)
    .single();

  if (!access) throw new Error("Access denied");

  const namespace = buildNamespace(device_id);

  const clientId = namespace;
  const username = namespace;
  const password = crypto.randomBytes(32).toString("hex");

  // 🔴 Kill previous sessions
  const { data: oldSessions } = await supabase
    .from("mqtt_sessions")
    .select("*")
    .eq("device_id", device_id);

  if (oldSessions) {
    for (const s of oldSessions) {
      await disconnectClient(s.client_id);
    }
  }

  // 🧹 Delete old sessions
  await supabase
    .from("mqtt_sessions")
    .delete()
    .eq("device_id", device_id);

  // 💾 Save new session
  await supabase.from("mqtt_sessions").insert({
    user_id,
    device_id,
    client_id: clientId,
    username,
    password_hash: crypto
      .createHash("sha256")
      .update(password)
      .digest("hex"),
    ip,
    expires_at: new Date(Date.now() + 60 * 60 * 1000),
  });

  return {
    clientId,
    username,
    password,
    namespace,
    broker: process.env.MQTT_HOST,
  };
}
