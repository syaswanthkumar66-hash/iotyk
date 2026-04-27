import express from "express";
import { createClient } from "@supabase/supabase-js";
import { verifyUser } from "../middleware/auth.js";
import { sha256, generateToken } from "../utils/crypto.js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 🔐 STEP 1: REQUEST PAIRING
router.post("/request", verifyUser, async (req, res) => {
  try {
    const { device_id, pair_token } = req.body;

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

    // validate pairing token
    const { data: tokenRow } = await supabase
      .from("pairing_tokens")
      .select("*")
      .eq("token", pair_token)
      .eq("device_id", device_id)
      .single();

    if (!tokenRow || tokenRow.used) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // generate owner token
    const owner_token = generateToken(16);

    res.json({
      namespace: device.namespace,
      mqtt_host: process.env.MQTT_HOST,
      owner_token
    });

  } catch {
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

    const expected = sha256(challenge + device.device_token);

    if (expected !== response) {
      return res.status(401).json({ error: "Invalid device" });
    }

    res.json({ success: true });

  } catch {
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;
