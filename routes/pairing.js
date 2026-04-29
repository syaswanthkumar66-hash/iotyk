import express from "express";
import { createClient } from "@supabase/supabase-js";
import { verifyUser } from "../middleware/auth.js";
import { generateToken, sha256 } from "../utils/crypto.js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ✅ STEP 1: CREATE PAIR TOKEN (ON DEMAND)
router.post("/request", verifyUser, async (req, res) => {
  try {
    const { device_id } = req.body;

    const { data: device } = await supabase
      .from("factory_devices")
      .select("*")
      .eq("device_id", device_id)
      .maybeSingle();

    if (!device) return res.status(404).json({ error: "Device not found" });

    if (device.paired) {
      return res.status(400).json({ error: "Already paired" });
    }

    const pair_token = generateToken(8);

    await supabase.from("pairing_tokens").insert({
      token: pair_token,
      device_id,
      expires_at: new Date(Date.now() + 5 * 60 * 1000)
    });

    const owner_token = generateToken(16);

    res.json({
      pair_token,
      namespace: device.namespace,
      mqtt_host: process.env.MQTT_HOST,
      owner_token
    });

  } catch {
    res.status(500).json({ error: "Pair request failed" });
  }
});

// ✅ STEP 2: VERIFY DEVICE
router.post("/verify", verifyUser, async (req, res) => {
  try {
    const { device_id, challenge, response } = req.body;

    const { data: device } = await supabase
      .from("factory_devices")
      .select("*")
      .eq("device_id", device_id)
      .maybeSingle();

    const expected = sha256(challenge + device.device_token);

    if (expected !== response) {
      return res.status(401).json({ error: "Invalid device" });
    }

    res.json({ success: true });

  } catch {
    res.status(500).json({ error: "Verify failed" });
  }
});

export default router;
