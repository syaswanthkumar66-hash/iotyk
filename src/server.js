require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');
const { createToken, requireAuth } = require('./auth');

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';

app.use(cors({ origin: allowedOrigin === '*' ? true : allowedOrigin }));
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await pool.query('select 1');
    res.json({
      ok: true,
      database: 'connected',
      mqttBrokerUrl: process.env.MQTT_BROKER_URL || 'wss://broker.hivemq.com:8884/mqtt',
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/auth/register', async (req, res) => {
  const { email, password, displayName } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `
        insert into users (email, password_hash, display_name)
        values ($1, $2, $3)
        returning id, email, display_name, created_at
      `,
      [email.trim().toLowerCase(), passwordHash, displayName || null]
    );

    const user = result.rows[0];
    const token = createToken(user);

    return res.status(201).json({
      token,
      user: mapUser(user),
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }

    return res.status(500).json({ error: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      `
        select id, email, password_hash, display_name, created_at
        from users
        where email = $1
      `,
      [email.trim().toLowerCase()]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = createToken(user);
    return res.json({
      token,
      user: mapUser(user),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
        select id, email, display_name, created_at
        from users
        where id = $1
      `,
      [req.user.id]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: mapUser(user) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/devices', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
        select *
        from devices
        where owner_id = $1
           or exists (
             select 1
             from jsonb_array_elements(shared_with) as member
             where member ->> 'id' = $1::text
           )
        order by created_at desc
      `,
      [req.user.id]
    );

    return res.json({ devices: result.rows.map(mapDevice) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/devices', requireAuth, async (req, res) => {
  const {
    id,
    name,
    type = 'relay',
    ip,
    macAddress,
    firmwareVersion = '1.0.0',
    secret,
  } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Device id is required' });
  }

  try {
    const result = await pool.query(
      `
        insert into devices (
          id, name, type, ip, mac_address, firmware_version,
          owner_id, secret, is_online, is_on
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, true, false)
        returning *
      `,
      [
        id,
        name || `Device ${String(id).slice(-4)}`,
        type,
        ip || null,
        macAddress || null,
        firmwareVersion,
        req.user.id,
        secret || null,
      ]
    );

    return res.status(201).json({ device: mapDevice(result.rows[0]) });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Device already exists' });
    }

    return res.status(500).json({ error: error.message });
  }
});

app.patch('/devices/:deviceId', requireAuth, async (req, res) => {
  const { deviceId } = req.params;
  const { name, isOn, isOnline, firmwareVersion, ip } = req.body;

  try {
    const result = await pool.query(
      `
        update devices
        set
          name = coalesce($1, name),
          is_on = coalesce($2, is_on),
          is_online = coalesce($3, is_online),
          firmware_version = coalesce($4, firmware_version),
          ip = coalesce($5, ip),
          updated_at = now()
        where id = $6
          and owner_id = $7
        returning *
      `,
      [name, isOn, isOnline, firmwareVersion, ip, deviceId, req.user.id]
    );

    const device = result.rows[0];
    if (!device) {
      return res.status(404).json({ error: 'Device not found or forbidden' });
    }

    return res.json({ device: mapDevice(device) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/devices/:deviceId', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
        delete from devices
        where id = $1
          and owner_id = $2
        returning id
      `,
      [req.params.deviceId, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Device not found or forbidden' });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/shares/generate', requireAuth, async (req, res) => {
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId is required' });
  }

  const otpCode = String(Math.floor(100000 + Math.random() * 900000));

  try {
    const ownership = await pool.query(
      'select id from devices where id = $1 and owner_id = $2',
      [deviceId, req.user.id]
    );

    if (!ownership.rows[0]) {
      return res.status(404).json({ error: 'Device not found or forbidden' });
    }

    const result = await pool.query(
      `
        insert into device_shares (device_id, otp_code, expires_at, status)
        values ($1, $2, now() + interval '10 minutes', 'pending')
        returning device_id, otp_code, expires_at, status
      `,
      [deviceId, otpCode]
    );

    return res.status(201).json({ share: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/shares/verify', requireAuth, async (req, res) => {
  const { otp } = req.body;

  if (!otp) {
    return res.status(400).json({ error: 'otp is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('begin');

    const shareResult = await client.query(
      `
        select *
        from device_shares
        where otp_code = $1
          and status = 'pending'
          and expires_at > now()
        for update
      `,
      [otp]
    );

    const share = shareResult.rows[0];
    if (!share) {
      await client.query('rollback');
      return res.status(400).json({ error: 'Invalid or expired sharing code' });
    }

    const deviceResult = await client.query(
      'select shared_with from devices where id = $1 for update',
      [share.device_id]
    );

    const device = deviceResult.rows[0];
    if (!device) {
      await client.query('rollback');
      return res.status(404).json({ error: 'Device not found' });
    }

    const sharedWith = Array.isArray(device.shared_with) ? device.shared_with : [];
    const alreadyShared = sharedWith.some((entry) => entry.id === req.user.id);

    if (!alreadyShared) {
      sharedWith.push({
        id: req.user.id,
        email: req.user.email,
        displayName: req.user.displayName || req.user.email,
        role: 'controller',
        addedAt: new Date().toISOString(),
      });
    }

    await client.query(
      `
        update devices
        set shared_with = $1::jsonb, updated_at = now()
        where id = $2
      `,
      [JSON.stringify(sharedWith), share.device_id]
    );

    await client.query(
      `
        update device_shares
        set status = 'accepted', accepted_by = $1
        where id = $2
      `,
      [req.user.id, share.id]
    );

    await client.query('commit');
    return res.json({ deviceId: share.device_id });
  } catch (error) {
    await client.query('rollback');
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/devices/:deviceId/shared-users', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
        select shared_with
        from devices
        where id = $1
          and owner_id = $2
      `,
      [req.params.deviceId, req.user.id]
    );

    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Device not found or forbidden' });
    }

    return res.json({ users: row.shared_with || [] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/devices/:deviceId/shared-users/:userId', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('begin');

    const deviceResult = await client.query(
      `
        select shared_with
        from devices
        where id = $1
          and owner_id = $2
        for update
      `,
      [req.params.deviceId, req.user.id]
    );

    const device = deviceResult.rows[0];
    if (!device) {
      await client.query('rollback');
      return res.status(404).json({ error: 'Device not found or forbidden' });
    }

    const sharedWith = (device.shared_with || []).filter((user) => user.id !== req.params.userId);

    await client.query(
      `
        update devices
        set shared_with = $1::jsonb, updated_at = now()
        where id = $2
      `,
      [JSON.stringify(sharedWith), req.params.deviceId]
    );

    await client.query('commit');
    return res.json({ ok: true });
  } catch (error) {
    await client.query('rollback');
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/alerts', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
        select *
        from alerts
        where user_id = $1
        order by created_at desc
        limit 50
      `,
      [req.user.id]
    );

    return res.json({ alerts: result.rows.map(mapAlert) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.patch('/alerts/:alertId/read', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
        update alerts
        set is_read = true
        where id = $1
          and user_id = $2
        returning *
      `,
      [req.params.alertId, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    return res.json({ alert: mapAlert(result.rows[0]) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/firmware/check', requireAuth, async (req, res) => {
  const { deviceType, currentVersion } = req.query;

  if (!deviceType || !currentVersion) {
    return res.status(400).json({ error: 'deviceType and currentVersion are required' });
  }

  try {
    const result = await pool.query(
      `
        select *
        from firmware
        where device_type = $1
          and version > $2
        order by version desc
        limit 1
      `,
      [String(deviceType), String(currentVersion)]
    );

    return res.json({ firmware: result.rows[0] || null });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.use((err, _req, res, _next) => {
  return res.status(500).json({ error: err.message || 'Unexpected server error' });
});

app.listen(port, () => {
  console.log(`Render server listening on port ${port}`);
});

function mapUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name || user.email.split('@')[0],
    createdAt: user.created_at,
  };
}

function mapDevice(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    ip: row.ip || '',
    macAddress: row.mac_address || '',
    firmwareVersion: row.firmware_version || '1.0.0',
    isOnline: Boolean(row.is_online),
    isOn: Boolean(row.is_on),
    ownerId: row.owner_id,
    sharedWith: row.shared_with || [],
    secret: row.secret || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAlert(row) {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    title: row.title,
    body: row.body,
    severity: row.severity,
    isRead: Boolean(row.is_read),
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}
