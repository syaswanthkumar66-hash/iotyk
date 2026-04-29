router.post("/request", verifyUser, async (req, res) => {
  try {
    const { device_id, pair_token } = req.body;

    console.log("PAIR REQ:", device_id, pair_token);

    // 🔎 1. Check device
    const { data: device, error: devErr } = await supabase
      .from("factory_devices")
      .select("*")
      .eq("device_id", device_id)
      .maybeSingle();

    if (devErr || !device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (device.paired) {
      return res.status(400).json({ error: "Already paired" });
    }

    // 🔎 2. Get pairing token (SAFE)
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("pairing_tokens")
      .select("*")
      .eq("token", pair_token)
      .eq("device_id", device_id)
      .maybeSingle();

    console.log("TOKEN DB:", tokenRow);

    // ❌ if not found
    if (tokenErr || !tokenRow) {
      return res.status(401).json({ error: "Invalid token (not found)" });
    }

    // ❌ if already used
    if (tokenRow.used) {
      return res.status(401).json({ error: "Token already used" });
    }

    // ❌ if expired
    if (new Date(tokenRow.expires_at) < new Date()) {
      return res.status(401).json({ error: "Token expired" });
    }

    // ✅ mark token used (optional but recommended)
    await supabase
      .from("pairing_tokens")
      .update({ used: true })
      .eq("token", pair_token);

    // 🔐 generate owner token
    const owner_token = generateToken(16);

    res.json({
      namespace: device.namespace,
      mqtt_host: process.env.MQTT_HOST,
      owner_token
    });

  } catch (err) {
    console.error("PAIR ERROR:", err);
    res.status(500).json({ error: "Pair request failed" });
  }
});
