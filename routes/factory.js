import express from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 🏭 GENERATE DEVICE (CORRECT ARCHITECTURE)
router.post("/device", async (req, res) => {
  try {
    const device_id = "esp32-" + crypto.randomBytes(4).toString("hex");
    const device_token = crypto.randomBytes(32).toString("hex");
    const namespace = crypto.randomBytes(16).toString("hex");

    const { error } = await supabase
      .from("factory_devices")
      .insert({
        device_id,
        device_token,
        namespace,
        status: "created",
        paired: false,
        created_at: new Date()
      });

    if (error) {
      console.error("DB ERROR:", error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    // ✅ SAFE RESPONSE (NO SECRET)
    res.json({
      success: true,
      config: {
        DEVICE_ID: device_id,
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


// 📦 GET DEVICES
router.get("/devices", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("factory_devices")
      .select("device_id, namespace, status, paired, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);

  } catch (err) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

export default router;
