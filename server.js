import express from "express";
import dotenv from "dotenv";
import mqttRoutes from "./routes/mqtt.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/api/v1/mqtt", mqttRoutes);

app.get("/api/v1/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(process.env.PORT, () => {
  console.log("Server running on port", process.env.PORT);
});
