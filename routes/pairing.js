import express from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { verifyUser } from "../middleware/auth.js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);


// 🔐 STEP 1: REQUEST PAIR TOKEN
router.post("/request", verifyUser, async (req, res) => {
  try {
    const { device_id, pair_token } = req.body;

    // check device exists
    const { data: device } = await supabase
      .from("factory_devices")
      .select("*")
      .eq("device_id", device_id)
      .single();

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (device.paired) {
      return res.status(400).json({ error: "Already paired" });
    }

    // verify token
    const { data: tokenRow } = await supabase
      .from("pairing_tokens")
      .select("*")
      .eq("token", pair_token)
      .eq("device_id", device_id)
      .single();

    if (!tokenRow || tokenRow.used || new Date(tokenRow.expires_at) < new Date()) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // generate owner token
    const owner_token = crypto.randomBytes(16).toString("hex");

    res.json({
      namespace: device.namespace,
      mqtt_host: process.env.MQTT_HOST,
      owner_token
    });

  } catch (err) {
    res.status(500).json({ error: "Pair request failed" });
  }
});


// 🔐 STEP 2: VERIFY DEVICE (challenge-response)
router.post("/verify", verifyUser, async (req, res) => {
  try {
    const { device_id, challenge, response } = req.body;

    const { data: device } = await supabase
      .from("factory_devices")
      .select("*")
      .eq("device_id", device_id)
      .single();

    if (!device) return res.status(404).json({ error: "Not found" });

    const expected = crypto
      .createHash("sha256")
      .update(challenge + device.device_token)
      .digest("hex");

    if (expected !== response) {
      return res.status(401).json({ error: "Invalid device" });
    }

    res.json({ success: true });

  } catch {
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;
