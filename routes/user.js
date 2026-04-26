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

    // 🔍 fetch devices linked to this user
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

export default router;
router.post("/add-device", verifyUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { device_id, device_key, key } = req.body;

    // 🔍 validate input
    if (!device_id || (!device_key && !key)) {
      return res.status(400).json({ error: "Missing device_id or key" });
    }

    const finalKey = device_key || key;

    // 🔎 check device exists
    const { data: device, error: findError } = await supabase
      .from("devices")
      .select("*")
      .eq("device_id", device_id)
      .single();

    if (findError || !device) {
      return res.status(404).json({ error: "Device not found" });
    }

    // 🔐 verify key (simple match)
    if (device.device_key !== finalKey) {
      return res.status(401).json({ error: "Invalid device key" });
    }

    // ⚠️ prevent already linked
    if (device.user_id) {
      return res.status(400).json({ error: "Device already linked" });
    }

    // 🔗 assign device to user
    const { error: updateError } = await supabase
      .from("devices")
      .update({ user_id: userId })
      .eq("device_id", device_id);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    res.json({
      success: true,
      message: "Device added successfully",
      device_id,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add device" });
  }
});
