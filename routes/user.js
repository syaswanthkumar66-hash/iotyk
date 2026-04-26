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
