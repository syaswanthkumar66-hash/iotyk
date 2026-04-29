// routes/sendCommand.js
import { supabase } from "../lib/supabase.js";

export async function sendCommand(req, res) {
  const user = req.user;
  const { device_id, command, payload } = req.body;

  const nonce = Date.now();

  const { data, error } = await supabase
    .from("device_commands")
    .insert({
      device_id,
      user_id: user.id,
      command_type: command,
      payload,
      nonce,
      expires_at: new Date(Date.now() + 60000),
    });

  if (error) return res.status(400).json({ error });

  res.json({ success: true });
}
