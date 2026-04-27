import express from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ⚙️ GENERATE DEVICE (SECURE VERSION)
router.post("/device", async (req, res) => {
  try {
    const device_id = "esp32-" + crypto.randomBytes(4).toString("hex");

    // 🔐 permanent secret (DO NOT EXPOSE)
    const device_token = crypto.randomBytes(32).toString("hex");

    const namespace = crypto.randomBytes(16).toString("hex");

    // 🔐 short-lived pairing token
    const pair_token = crypto.randomBytes(8).toString("hex");

    // ⏳ expiry (10 min)
    const expires_at = new Date(Date.now() + 10 * 60 * 1000);

    // ✅ insert factory device
    const { error: factoryError } = await supabase
      .from("factory_devices")
      .insert({
        device_id,
        device_token,
        namespace,
        status: "created",
        paired: false,
        created_at: new Date()
      });

    if (factoryError) {
      console.error("DB ERROR:", factoryError);
      return res.status(500).json({
        success: false,
        error: factoryError.message
      });
    }

    // ✅ insert pairing token
    const { error: tokenError } = await supabase
      .from("pairing_tokens")
      .insert({
        token: pair_token,
        device_id,
        expires_at
      });

    if (tokenError) {
      console.error("TOKEN ERROR:", tokenError);
      return res.status(500).json({
        success: false,
        error: tokenError.message
      });
    }

    // ✅ SAFE RESPONSE (NO SECRETS)
    res.json({
      success: true,
      config: {
        DEVICE_ID: device_id,
        PAIR_TOKEN: pair_token,
        MQTT_HOST: process.env.MQTT_HOST
      }
    });

  } catch (err) {
    console.error("FACTORY ERROR:", err);
    res.status(500).json({
      success: false,
      error: "Factory generation failed"
    });
  }
});


// 📦 GET ALL FACTORY DEVICES (SAFE VERSION)
router.get("/devices", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("factory_devices")
      .select("device_id, namespace, status, paired, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("FETCH ERROR:", error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json(data);

  } catch (err) {
    console.error("FACTORY FETCH ERROR:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch devices"
    });
  }
});

export default router;
