import express from "express";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import sanitizeHtml from "sanitize-html";

import cors from 'cors';

dotenv.config();

// 🔑 Validate environment variables
const {
  JWT_SECRET,
  TALKSASA_URL,
  TALKSASA_API_KEY,
  TALKSASA_SENDER_ID,
  TALKSASA_WEBHOOK_SECRET,
  FRONTEND_URL = "https://reinoservices.vercel.app",
  PORT = 3000,
} = process.env;

if (!JWT_SECRET || !FRONTEND_URL || !TALKSASA_URL || !TALKSASA_API_KEY || !TALKSASA_SENDER_ID || !TALKSASA_WEBHOOK_SECRET) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const app = express();
app.use(bodyParser.json());

app.use(cors({ origin: 'https://reinoservices.vercel.app' }));

// 🔐 Rate limiting for all endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: "Too many requests, please try again later.", statusCode: 429 },
});
app.use("/developer/register", limiter);
app.use("/developer/login", limiter);
app.use("/developer/generate-credentials", limiter);
app.use("/house-interest", limiter);

// 🔑 In-memory storage (for demo, use DB in production)
const developers = {}; // username -> { email, phone, passwordHash, userKey, userSecret }
const houseRequests = {}; // houseId -> { houseType, location, tenantPhone, ownerPhone, timestamp }

// 🔐 JWT Secret
const jwtSecret = JWT_SECRET;

// 🔔 Talksasa SMS Config
const talksasaUrl = TALKSASA_URL;
const talksasaApiKey = TALKSASA_API_KEY;
const senderId = TALKSASA_SENDER_ID;
const webhookSecret = TALKSASA_WEBHOOK_SECRET;

// 🔐 Middleware for API authentication using headers
function authenticate(req, res, next) {
  const requestId = uuidv4();
  req.requestId = requestId;
  const userKey = req.header("User_Key");
  const userSecret = req.header("User_Secret");

  if (!userKey || !userSecret) {
    console.error(`Request ${requestId}: Missing User_Key or User_Secret headers`);
    return res.status(401).json({ error: "Missing User_Key or User_Secret headers", statusCode: 401 });
  }

  const dev = Object.values(developers).find(
    (d) => d.userKey === userKey && d.userSecret === userSecret
  );

  if (!dev) {
    console.error(`Request ${requestId}: Invalid credentials`);
    return res.status(403).json({ error: "Invalid credentials", statusCode: 403 });
  }

  req.developer = dev;
  next();
}

// 🔐 Middleware for login authentication using JWT
function requireLogin(req, res, next) {
  const requestId = uuidv4();
  req.requestId = requestId;
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    console.error(`Request ${requestId}: Missing Authorization header`);
    return res.status(401).json({ error: "Missing Authorization header", statusCode: 401 });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    console.error(`Request ${requestId}: Invalid token format`);
    return res.status(401).json({ error: "Invalid token format", statusCode: 401 });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.username = decoded.username;
    next();
  } catch (err) {
    console.error(`Request ${requestId}: Invalid or expired token`, err);
    return res.status(403).json({ error: "Invalid or expired token", statusCode: 403 });
  }
}

// 📌 Developer registration
app.post("/developer/register", async (req, res) => {
  const requestId = uuidv4();
  const { username, email, phone, password } = req.body;

  if (!username || !email || !phone || !password) {
    console.error(`Request ${requestId}: Missing required fields`);
    return res.status(400).json({ error: "All fields are required", statusCode: 400 });
  }

  // Sanitize inputs
  const sanitizedUsername = sanitizeHtml(username);
  const sanitizedEmail = sanitizeHtml(email);
  const sanitizedPhone = sanitizeHtml(phone);

  if (developers[sanitizedUsername]) {
    console.error(`Request ${requestId}: Username already exists`);
    return res.status(400).json({ error: "Username already exists", statusCode: 400 });
  }

  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(sanitizedPhone)) {
    console.error(`Request ${requestId}: Invalid phone number format`);
    return res.status(400).json({ error: "Phone number must be in E.164 format (e.g., +254123456789)", statusCode: 400 });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    developers[sanitizedUsername] = { email: sanitizedEmail, phone: sanitizedPhone, passwordHash };
    console.log(`Request ${requestId}: User ${sanitizedUsername} registered successfully`);
    res.json({ message: "Registration successful" });
  } catch (error) {
    console.error(`Request ${requestId}: Registration Error:`, error.message, error.stack);
    res.status(500).json({ error: "Failed to register user", statusCode: 500 });
  }
});

// 📌 Developer login
app.post("/developer/login", async (req, res) => {
  const requestId = uuidv4();
  const { username, password } = req.body;
  const sanitizedUsername = sanitizeHtml(username);
  const dev = developers[sanitizedUsername];

  if (!dev) {
    console.error(`Request ${requestId}: Invalid username`);
    return res.status(400).json({ error: "Invalid username or password", statusCode: 400 });
  }

  try {
    const match = await bcrypt.compare(password, dev.passwordHash);
    if (!match) {
      console.error(`Request ${requestId}: Invalid password`);
      return res.status(400).json({ error: "Invalid username or password", statusCode: 400 });
    }

    const token = jwt.sign({ username: sanitizedUsername }, jwtSecret, { expiresIn: "1h" });
    console.log(`Request ${requestId}: User ${sanitizedUsername} logged in successfully`);
    res.json({ token, expiresIn: 3600 }); // 1 hour in seconds
  } catch (error) {
    console.error(`Request ${requestId}: Login Error:`, error.message, error.stack);
    res.status(500).json({ error: "Failed to log in", statusCode: 500 });
  }
});

// 📌 Fetch user details
app.get("/developer/me", requireLogin, (req, res) => {
  const requestId = uuidv4();
  const dev = developers[req.username];

  if (!dev) {
    console.error(`Request ${requestId}: User not found`);
    return res.status(404).json({ error: "User not found", statusCode: 404 });
  }

  console.log(`Request ${requestId}: Fetched details for user ${req.username}`);
  res.json({ username: req.username, email: dev.email, phone: dev.phone });
});

// 📌 Validate token
app.get("/developer/validate-token", requireLogin, (req, res) => {
  const requestId = uuidv4();
  console.log(`Request ${requestId}: Token validated for user ${req.username}`);
  res.json({ valid: true, username: req.username });
});

// 📌 Generate credentials (after login)
app.post("/developer/generate-credentials", requireLogin, (req, res) => {
  const requestId = uuidv4();
  const dev = developers[req.username];

  if (dev.userKey && dev.userSecret) {
    console.log(`Request ${requestId}: Credentials already exist for user ${req.username}`);
    return res.status(200).json({
      userKey: dev.userKey,
      userSecret: dev.userSecret,
      message: "Credentials already exist. Use these or regenerate with caution.",
    });
  }

  try {
    dev.userKey = uuidv4();
    dev.userSecret = uuidv4();
    console.log(`Request ${requestId}: Credentials generated for user ${req.username}`);
    res.json({
      userKey: dev.userKey,
      userSecret: dev.userSecret,
      message: "Credentials generated successfully. Use these in User_Key and User_Secret headers for authenticated requests",
    });
  } catch (error) {
    console.error(`Request ${requestId}: Credential Generation Error:`, error.message, error.stack);
    res.status(500).json({ error: "Failed to generate credentials", statusCode: 500 });
  }
});

// 📌 Tenant shows interest → send SMS to owner
app.post("/house-interest", authenticate, async (req, res) => {
  const requestId = uuidv4();
  const { houseId, houseType, location, tenantPhone, ownerPhone } = req.body;

  // Validate input
  if (!houseId || !houseType || !location || !tenantPhone || !ownerPhone) {
    console.error(`Request ${requestId}: Missing required fields`);
    return res.status(400).json({ error: "All fields are required", statusCode: 400 });
  }

  // Sanitize inputs
  const sanitizedHouseId = sanitizeHtml(houseId);
  const sanitizedHouseType = sanitizeHtml(houseType);
  const sanitizedLocation = sanitizeHtml(location);
  const sanitizedTenantPhone = sanitizeHtml(tenantPhone);
  const sanitizedOwnerPhone = sanitizeHtml(ownerPhone);

  // Validate houseType and location
  if (sanitizedHouseType.length > 50 || sanitizedLocation.length > 100) {
    console.error(`Request ${requestId}: houseType or location too long`);
    return res.status(400).json({ error: "House type (max 50 chars) or location (max 100 chars) too long", statusCode: 400 });
  }
  if (!/^[a-zA-Z0-9\s-]+$/.test(sanitizedHouseType) || !/^[a-zA-Z0-9\s,-]+$/.test(sanitizedLocation)) {
    console.error(`Request ${requestId}: Invalid characters in houseType or location`);
    return res.status(400).json({ error: "House type and location can only contain letters, numbers, spaces, hyphens, and commas", statusCode: 400 });
  }

  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(sanitizedTenantPhone) || !phoneRegex.test(sanitizedOwnerPhone)) {
    console.error(`Request ${requestId}: Invalid phone number format`);
    return res.status(400).json({ error: "Phone numbers must be in E.164 format (e.g., +254123456789)", statusCode: 400 });
  }

  // Store request for webhook with timestamp
  houseRequests[sanitizedHouseId] = {
    houseType: sanitizedHouseType,
    location: sanitizedLocation,
    tenantPhone: sanitizedTenantPhone,
    ownerPhone: sanitizedOwnerPhone,
    timestamp: Date.now(),
  };

  const smsText = `A tenant is interested in ${sanitizedHouseType} at ${sanitizedLocation} (ID: ${sanitizedHouseId}).
Reply with:
1 - Available
2 - Not Available`;

  try {
    const response = await fetch(talksasaUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${talksasaApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        recipient: sanitizedOwnerPhone,
        sender_id: senderId,
        type: "plain",
        message: smsText,
      }),
    });

    const result = await response.json();
    console.log(`Request ${requestId}: Talksasa Response:`, { status: response.status, body: result, request: req.body });

    if (!response.ok || result.status !== "success") {
      throw new Error(`Talksasa API error: ${result.message || "Unknown error"}`);
    }

    console.log(`Request ${requestId}: House interest request sent for house ${sanitizedHouseId}`);
    res.json({
      message: "House availability request sent via SMS",
      houseId: sanitizedHouseId,
      houseType: sanitizedHouseType,
      location: sanitizedLocation,
      tenantPhone: sanitizedTenantPhone,
      ownerPhone: sanitizedOwnerPhone,
      timestamp: houseRequests[sanitizedHouseId].timestamp,
      status: "Pending",
    });
  } catch (error) {
    console.error(`Request ${requestId}: SMS Error:`, { message: error.message, stack: error.stack, request: req.body });
    res.status(500).json({ error: "Failed to send SMS", statusCode: 500, details: error.message });
  }
});

// 📌 Talksasa Webhook for owner SMS replies
app.post("/sms-reply", async (req, res) => {
  const requestId = uuidv4();
  const { from, text, webhookSecret: receivedSecret, houseId, houseType, location, tenantPhone } = req.body;

  // Validate webhook secret
  if (receivedSecret !== webhookSecret) {
    console.error(`Request ${requestId}: Invalid webhook secret`);
    return res.status(403).json({ error: "Invalid webhook secret", statusCode: 403 });
  }

  // Validate required fields
  if (!from || !text || !houseId || !tenantPhone) {
    console.error(`Request ${requestId}: Missing required fields in webhook payload`);
    return res.status(400).json({ error: "Missing required fields: from, text, houseId, tenantPhone", statusCode: 400 });
  }

  // Fallback to stored data if webhook payload is incomplete
  const storedRequest = houseRequests[houseId] || {};
  const sanitizedHouseId = sanitizeHtml(houseId);
  const sanitizedHouseType = sanitizeHtml(houseType || storedRequest.houseType || "Unknown");
  const sanitizedLocation = sanitizeHtml(location || storedRequest.location || "Unknown");
  const sanitizedTenantPhone = sanitizeHtml(tenantPhone);
  const sanitizedFrom = sanitizeHtml(from);
  const sanitizedText = sanitizeHtml(text);

  if (!storedRequest.tenantPhone) {
    console.error(`Request ${requestId}: No stored request found for house ${sanitizedHouseId}`);
    return res.status(404).json({ error: "No house request found for this ID", statusCode: 404 });
  }

  const reply = sanitizedText.trim();
  let statusMessage;

  if (reply === "1") {
    statusMessage = `Good news! ${sanitizedHouseType} at ${sanitizedLocation} (ID: ${sanitizedHouseId}) is AVAILABLE ✅`;
  } else if (reply === "2") {
    statusMessage = `Sorry, ${sanitizedHouseType} at ${sanitizedLocation} (ID: ${sanitizedHouseId}) is NOT available ❌`;
  } else {
    console.error(`Request ${requestId}: Invalid reply: ${reply}`);
    return res.status(400).json({ error: "Invalid reply. Please reply with 1 (Available) or 2 (Not Available).", statusCode: 400 });
  }

  try {
    const response = await fetch(talksasaUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${talksasaApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        recipient: sanitizedTenantPhone,
        sender_id: senderId,
        type: "plain",
        message: statusMessage,
      }),
    });

    const result = await response.json();
    console.log(`Request ${requestId}: Talksasa Response:`, { status: response.status, body: result, request: req.body });

    if (!response.ok || result.status !== "success") {
      throw new Error(`Talksasa API error: ${result.message || "Unknown error"}`);
    }

    // Clean up stored request
    delete houseRequests[sanitizedHouseId];

    console.log(`Request ${requestId}: Notified tenant ${sanitizedTenantPhone} for house ${sanitizedHouseId}`);
    res.json({
      success: true,
      houseId: sanitizedHouseId,
      status: statusMessage,
      from: sanitizedFrom,
      text: sanitizedText,
    });
  } catch (error) {
    console.error(`Request ${requestId}: Notify Tenant Error:`, { message: error.message, stack: error.stack, request: req.body });
    res.status(500).json({ error: "Failed to notify tenant", statusCode: 500, details: error.message });
  }
});

// 📌 Clean up stale house requests (older than 24 hours)
setInterval(() => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  Object.keys(houseRequests).forEach((houseId) => {
    if (now - houseRequests[houseId].timestamp > oneDay) {
      console.log(`Cleaning up stale house request: ${houseId}`);
      delete houseRequests[houseId];
    }
  });
}, 60 * 60 * 1000); // Run every hour

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));