// services/emqxCloud.js
import fetch from "node-fetch";

const BASE = process.env.EMQX_BASE_URL;

function getAuthHeader() {
  const token = Buffer.from(
    process.env.EMQX_API_KEY + ":" + process.env.EMQX_API_SECRET
  ).toString("base64");

  return {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json"
  };
}
