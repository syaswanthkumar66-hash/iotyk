import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

router.post("/auth", async (req, res) => {
  const { username, password } = req.body;

  const { data: device } = await supabase
    .from("factory_devices")
    .select("*")
    .eq("device_id", username)
    .maybeSingle();

  if (!device || device.device_token !== password) {
    return res.json({ result: "deny" });
  }

  res.json({ result: "allow" });
});

export default router;
