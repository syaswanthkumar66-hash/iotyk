import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import factoryRoutes from "./routes/factory.js";
import pairingRoutes from "./routes/pairing.js";
import userRoutes from "./routes/user.js";
import mqttRoutes from "./routes/mqtt.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/v1/factory", factoryRoutes);
app.use("/api/v1/pair", pairingRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/mqtt", mqttRoutes);

app.get("/api/v1/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running...");
});
