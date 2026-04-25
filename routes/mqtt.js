// routes/mqtt.js
router.post("/refresh", verifyUser, async (req, res) => {
  const { device_id } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  const session = await createMQTTSession(req.user.id, device_id, ip);

  res.json({ success: true, data: { ...session, expires_in: 900 } });
});
