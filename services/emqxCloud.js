import fetch from "node-fetch";

const BASE = process.env.EMQX_BASE_URL;

// 🔐 Auth header
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

  const text = await res.text();
  console.log("CREATE USER:", text);

  if (!res.ok) {
    throw new Error("EMQX createUser failed: " + text);
  }
}

// 🔹 Create ACL (FIXED)
export async function createACL(username, namespace, role) {
  let rules = [];

  if (role === "viewer") {
    rules = [
      {
        permission: "allow",
        action: "subscribe",
        topic: `nexus/${namespace}/status`
      }
    ];
  } else {
    rules = [
      {
        permission: "allow",
        action: "publish",
        topic: `nexus/${namespace}/command`
      },
      {
        permission: "allow",
        action: "subscribe",
        topic: `nexus/${namespace}/status`
      }
    ];
  }

  const res = await fetch(
    `${BASE}/authorization/sources/built_in_database/rules`,
    {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({
        rules: [
          {
            username: username,
            rules: rules
          }
        ]
      })
    }
  );

  const text = await res.text();
  console.log("ACL RESPONSE:", text);

  if (!res.ok) {
    throw new Error("EMQX ACL failed: " + text);
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

  const text = await res.text();
  console.log("DELETE USER:", text);

  if (!res.ok) {
    throw new Error("EMQX deleteUser failed: " + text);
  }
}
