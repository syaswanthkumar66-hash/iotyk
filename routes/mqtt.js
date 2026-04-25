import express from "express";
import { verifyUser } from "../middleware/auth.js";
import { createMQTTSession } from "../services/mqttSession.js";

const router = express.Router();

// 🔹 Create session
router.post("/session", verifyUser, async (req, res) => {
  try {
    const { device_id } = req.body;

    const ip =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    const session = await createMQTTSession(
      req.user.id,
      device_id,
      ip
    );

    res.json({
      success: true,
      data: session,
    });

  } catch (err) {
    console.error("SESSION ERROR:", err.message);

    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});

// 🔹 Refresh session
router.post("/refresh", verifyUser, async (req, res) => {
  try {
    const { device_id } = req.body;

    const ip =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    const session = await createMQTTSession(
      req.user.id,
      device_id,
      ip
    );

    res.json({
      success: true,
      data: session,
    });

  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
