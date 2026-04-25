router.post("/session", verifyUser, async (req, res) => {
  try {
    const { device_id } = req.body;

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    const session = await createMQTTSession(
      req.user.id,
      device_id,
      ip
    );

    res.json({
      success: true,
      data: {
        ...session,
        expires_in: 3600,
      },
    });

  } catch (err) {
    console.error("SESSION ERROR:", err.message);

    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});
