import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mqttRoutes from "./routes/mqtt.js";
import factoryRoutes from "./routes/factory.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js"; 
import pairingRoutes from "./routes/pairing.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors()); // quick fix
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/pair", pairingRoutes);
app.use("/api/v1/user", userRoutes); 
app.use("/api/v1/mqtt", mqttRoutes);
app.use("/api/v1/factory", factoryRoutes);

app.get("/api/v1/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(process.env.PORT, () => {
  console.log("Server running on port", process.env.PORT);
});
