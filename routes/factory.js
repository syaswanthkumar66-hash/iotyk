import express from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ⚙️ GENERATE DEVICE
router.post("/device", async (req, res) => {
  try {
    const DEVICE_ID = "esp32-" + crypto.randomBytes(4).toString("hex");
    const DEVICE_SALT = crypto.randomBytes(16).toString("hex");
    const NAMESPACE = crypto.randomBytes(16).toString("hex");

    const { error } = await supabase
      .from("factory_devices")
      .insert({
        device_id: DEVICE_ID,
        device_salt: DEVICE_SALT,
        namespace: NAMESPACE,
        status: "created",
        created_at: new Date()
      });

    if (error) {
      console.error("DB ERROR:", error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      config: {
        DEVICE_ID,
        DEVICE_SALT,
        NAMESPACE,
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


// 📦 GET ALL FACTORY DEVICES (✅ FIX ADDED)
router.get("/devices", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("factory_devices")
      .select("device_id, device_salt, namespace, status, created_at")
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
