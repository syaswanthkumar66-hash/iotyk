import crypto from "crypto";
import fetch from "node-fetch";
import { supabase } from "./supabase.js";

// 🔐 Namespace generator
function buildNamespace(device_id) {
  return crypto
    .createHmac("sha256", process.env.TOPIC_SECRET)
    .update(device_id)
    .digest("hex")
    .substring(0, 32);
}

// 🔴 Disconnect existing MQTT client
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
    console.log("Disconnect failed:", err.message);
  }
}

// 🚀 MAIN FUNCTION
export async function createMQTTSession(user_id, device_id, ip) {

  // 🔐 Check user access
  const { data: access } = await supabase
    .from("device_access")
    .select("role")
    .eq("user_id", user_id)
    .eq("device_id", device_id)
    .single();

  if (!access) throw new Error("Access denied");

  // 🔑 Generate namespace
  const namespace = buildNamespace(device_id);

  const clientId = namespace;
  const username = namespace;
  const password = crypto.randomBytes(32).toString("hex");

  // 🔴 Fetch old sessions
  const { data: oldSessions } = await supabase
    .from("mqtt_sessions")
    .select("*")
    .eq("device_id", device_id);

  // 🔴 Disconnect old sessions
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

  // ⏱️ 15 min expiry
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // 💾 Store new session
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
    expires_at: expiresAt,
  });

  return {
    clientId,
    username,
    password,
    namespace,
    broker: process.env.MQTT_HOST,
    expires_in: 900
  };
}
