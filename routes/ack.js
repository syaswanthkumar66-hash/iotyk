// routes/ack.js
import { supabase } from "../lib/supabase.js";

export async function ackCommand(req, res) {
  const { command_id } = req.body;

  await supabase
    .from("device_commands")
    .update({
      state: "acknowledged",
      ack_at: new Date(),
    })
    .eq("id", command_id);

  res.json({ success: true });
}
