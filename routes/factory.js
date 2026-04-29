import express from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ✅ GENERATE DEVICE (NO PAIR TOKEN HERE)
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
        paired: false
      });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      config: {
        DEVICE_ID: device_id,
        MQTT_HOST: process.env.MQTT_HOST
      }
    });

  } catch {
    res.status(500).json({ error: "Factory error" });
  }
});

// 📦 LIST DEVICES
router.get("/devices", async (req, res) => {
  const { data, error } = await supabase
    .from("factory_devices")
    .select("device_id, namespace, status, paired");

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

export default router;
