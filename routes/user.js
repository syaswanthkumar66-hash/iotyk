import express from "express";
import { createClient } from "@supabase/supabase-js";
import { verifyUser } from "../middleware/auth.js";

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

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);

  } catch {
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});


// 🔗 FINAL LINK DEVICE (NO KEY CHECK HERE)
router.post("/add-device", verifyUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { device_id, owner_token } = req.body;

    if (!device_id || !owner_token) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const { data: factoryDevice } = await supabase
      .from("factory_devices")
      .select("*")
      .eq("device_id", device_id)
      .single();

    if (!factoryDevice) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (factoryDevice.paired) {
      return res.status(400).json({ error: "Already paired" });
    }

    // insert into devices
    const { error: insertError } = await supabase
      .from("devices")
      .insert({
        device_id,
        user_id: userId,
        owner_token,
        topic_namespace: factoryDevice.namespace,
        status: "offline",
        current_state: {}
      });

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    // mark paired
    await supabase
      .from("factory_devices")
      .update({
        paired: true,
        status: "paired",
        paired_at: new Date()
      })
      .eq("device_id", device_id);

    res.json({ success: true });

  } catch {
    res.status(500).json({ error: "Pairing failed" });
  }
});

export default router;
