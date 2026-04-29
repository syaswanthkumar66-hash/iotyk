import express from "express";
import { createClient } from "@supabase/supabase-js";
import { verifyUser } from "../middleware/auth.js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET DEVICES
router.get("/devices", verifyUser, async (req, res) => {
  const { data } = await supabase
    .from("devices")
    .select("*")
    .eq("user_id", req.user.id);

  res.json(data);
});

// ADD DEVICE
router.post("/add-device", verifyUser, async (req, res) => {
  const { device_id, owner_token } = req.body;

  const { data: factoryDevice } = await supabase
    .from("factory_devices")
    .select("*")
    .eq("device_id", device_id)
    .maybeSingle();

  if (!factoryDevice) {
    return res.status(404).json({ error: "Not found" });
  }

  await supabase.from("devices").insert({
    device_id,
    user_id: req.user.id,
    owner_token,
    topic_namespace: factoryDevice.namespace,
    status: "offline"
  });

  await supabase
    .from("factory_devices")
    .update({ paired: true, status: "paired" })
    .eq("device_id", device_id);

  res.json({ success: true });
});

export default router;
