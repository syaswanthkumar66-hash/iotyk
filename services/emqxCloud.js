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

// 🔹 Create MQTT User
export async function createUser(username, password) {
  const res = await fetch(
    `${BASE}/authentication/password_based:built_in_database/users`,
    {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({
        user_id: username,
        password: password
      })
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error("EMQX createUser failed: " + err);
  }
}

// 🔹 Create ACL (STRICT)
export async function createACL(username, namespace, role) {
  let rules = [];

  if (role === "viewer") {
    rules = [
      { action: "subscribe", topic: `nexus/${namespace}/status` }
    ];
  } else {
    rules = [
      { action: "publish", topic: `nexus/${namespace}/command` },
      { action: "subscribe", topic: `nexus/${namespace}/status` }
    ];
  }

  const res = await fetch(
    `${BASE}/authorization/sources/built_in_database/rules/users/${username}`,
    {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ rules })
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error("EMQX ACL failed: " + err);
  }
}

// 🔹 Delete User
export async function deleteUser(username) {
  const res = await fetch(
    `${BASE}/authentication/password_based:built_in_database/users/${username}`,
    {
      method: "DELETE",
      headers: getAuthHeader()
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error("EMQX deleteUser failed: " + err);
  }
}
