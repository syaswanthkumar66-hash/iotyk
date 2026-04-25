// routes/mqtt.js
import express from "express";
import { verifyUser } from "../middleware/auth.js";
import { createMQTTSession } from "../services/mqttSession.js";

const router = express.Router();

router.post("/session", verifyUser, async (req, res) => {
  try {
    const { device_id } = req.body;

    const session = await createMQTTSession(
      req.user.id,
      device_id
    );

    res.json({
      success: true,
      data: {
        ...session,
        expires_in: 3600
      }
    });

  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

export default router;
