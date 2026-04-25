import express from "express";
import crypto from "crypto";
import { supabase } from "../services/supabase.js";

const router = express.Router();

// 🔒 simple factory auth (Supabase JWT must exist)
router.post("/device", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "No token" });

    // verify user
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // OPTIONAL: restrict factory users
    if (!data.user.email.endsWith("@yourfactory.com")) {
      return res.status(403).json({ error: "Factory only" });
    }

    // 🔧 generate device
    const device_id = "esp32-" + crypto.randomBytes(4).toString("hex");
    const device_salt = crypto.randomBytes(16).toString("hex");

    const namespace = crypto
      .createHmac("sha256", process.env.TOPIC_SECRET)
      .update(device_id)
      .digest("hex")
      .substring(0, 32);

    // store in DB
    const { data: inserted } = await supabase
      .from("devices")
      .insert({
        device_id,
        device_salt,
        topic_namespace: namespace
      })
      .select()
      .single();

    res.json({
      success: true,
      device: inserted,
      config: {
        DEVICE_ID: device_id,
        DEVICE_SALT: device_salt,
        NAMESPACE: namespace,
        MQTT_HOST: process.env.MQTT_HOST
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
