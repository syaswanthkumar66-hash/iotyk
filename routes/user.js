import express from "express";
import { createClient } from "@supabase/supabase-js";
import { verifyUser } from "../middleware/auth.js";
import { hashCredential } from "../utils/crypto.js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 📦 GET USER DEVICES
router.get("/devices", verifyUser, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("devices")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});


// 🔗 ADD DEVICE (FINAL FIXED)
router.post("/add-device", verifyUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { device_id, device_key, key } = req.body;

    const finalKey = device_key || key;

    if (!device_id || !finalKey) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // 🔎 1. Check factory_devices
    const { data: factoryDevice, error: findError } = await supabase
      .from("factory_devices")
      .select("*")
      .eq("device_id", device_id)
      .single();

    if (findError || !factoryDevice) {
      return res.status(404).json({ error: "Device not found in factory" });
    }

    // 🔐 2. Verify key
    if (factoryDevice.device_salt !== finalKey) {
      return res.status(401).json({ error: "Invalid device key" });
    }

    // ⚠️ 3. Prevent duplicate pairing
    if (factoryDevice.status === "paired") {
      return res.status(400).json({ error: "Device already paired" });
    }

    // ✅ 4. Generate MQTT credential hash (FIXED)
    const hash = hashCredential(factoryDevice.device_salt);

    // 🔗 5. Insert into devices table
    const { error: insertError } = await supabase
      .from("devices")
      .insert({
        device_id: factoryDevice.device_id,
        device_salt: factoryDevice.device_salt,
        topic_namespace: factoryDevice.namespace,
        user_id: userId,
        mqtt_credential_hash: hash,   // ✅ REQUIRED FIELD
        current_state: {},
        status: "offline"
      });

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    // 🔄 6. Update factory status
    await supabase
      .from("factory_devices")
      .update({
        status: "paired",
        paired_at: new Date()
      })
      .eq("device_id", device_id);

    res.json({
      success: true,
      message: "Device paired successfully",
      device_id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Pairing failed" });
  }
});

export default router;
