import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 🔐 LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return res.status(401).json({ error: error?.message || "Login failed" });
    }

    // ✅ MQTT URL from ENV
    const mqttUrl = process.env.MQTT_HOST.startsWith("wss://")
      ? process.env.MQTT_HOST
      : `wss://${process.env.MQTT_HOST}`;

    res.json({
      token: data.session.access_token,
      mqtt: {
        url: mqttUrl,
        username: data.user.id,
        password: process.env.TOPIC_SECRET,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
