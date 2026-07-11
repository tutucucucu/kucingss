const express = require("express");
const path = require("path");
const fs = require("fs");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

const JWT_SECRET = process.env.JWT_SECRET || "kucingss_secret_2025";
const DB_PATH = process.env.NODE_ENV === "production" ? "/tmp/db.json" : path.join(__dirname, "db.json");

if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ users: [], cats: [] }));
}

const adapter = new FileSync(DB_PATH);
const db = low(adapter);
db.defaults({ users: [], cats: [] }).write();

function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// AUTH
app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Semua field wajib diisi" });
  if (db.get("users").find({ email }).value()) return res.status(400).json({ error: "Email sudah terdaftar" });
  const hash = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), name, email, password: hash, bio: "", wa: "", link: "", linkTitle: "", avatar: "", createdAt: Date.now() };
  db.get("users").push(user).write();
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, bio: user.bio, wa: user.wa, link: user.link, linkTitle: user.linkTitle, avatar: user.avatar } });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = db.get("users").find({ email }).value();
  if (!user) return res.status(400).json({ error: "Email tidak ditemukan" });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: "Password salah" });
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, bio: user.bio, wa: user.wa, link: user.link, linkTitle: user.linkTitle, avatar: user.avatar } });
});

app.get("/api/me", auth, (req, res) => {
  const user = db.get("users").find({ id: req.user.id }).value();
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, name: user.name, email: user.email, bio: user.bio, wa: user.wa, link: user.link, linkTitle: user.linkTitle, avatar: user.avatar });
});

app.put("/api/me", auth, (req, res) => {
  const { name, bio, wa, link, linkTitle, avatar } = req.body;
  db.get("users").find({ id: req.user.id }).assign({ name, bio, wa, link, linkTitle, avatar }).write();
  const user = db.get("users").find({ id: req.user.id }).value();
  res.json({ id: user.id, name: user.name, email: user.email, bio: user.bio, wa: user.wa, link: user.link, linkTitle: user.linkTitle, avatar: user.avatar });
});

// CATS
app.get("/api/cats", (req, res) => {
  const cats = db.get("cats").filter({ deleted: false }).value();
  const users = db.get("users").value();
  const result = cats.map(function(c) {
    const u = users.find(function(u) { return u.id === c.userId; });
    return Object.assign({}, c, { seller: u ? { id: u.id, name: u.name, avatar: u.avatar, wa: u.wa } : null });
  });
  res.json(result.reverse());
});

app.get("/api/cats/:id", (req, res) => {
  const cat = db.get("cats").find({ id: req.params.id, deleted: false }).value();
  if (!cat) return res.status(404).json({ error: "Not found" });
  const u = db.get("users").find({ id: cat.userId }).value();
  res.json(Object.assign({}, cat, { seller: u ? { id: u.id, name: u.name, avatar: u.avatar, wa: u.wa } : null }));
});

app.post("/api/cats", auth, (req, res) => {
  const { name, price, description, image } = req.body;
  if (!name || !price || !description) return res.status(400).json({ error: "Nama, harga, dan deskripsi wajib diisi" });
  const cat = { id: uuidv4(), userId: req.user.id, name, price: parseInt(price), description, image: image || "", deleted: false, createdAt: Date.now() };
  db.get("cats").push(cat).write();
  res.json(cat);
});

app.put("/api/cats/:id", auth, (req, res) => {
  const cat = db.get("cats").find({ id: req.params.id }).value();
  if (!cat) return res.status(404).json({ error: "Not found" });
  if (cat.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  const { name, price, description, image } = req.body;
  db.get("cats").find({ id: req.params.id }).assign({ name, price: parseInt(price), description, image }).write();
  res.json(db.get("cats").find({ id: req.params.id }).value());
});

app.delete("/api/cats/:id", auth, (req, res) => {
  const cat = db.get("cats").find({ id: req.params.id }).value();
  if (!cat) return res.status(404).json({ error: "Not found" });
  if (cat.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  db.get("cats").find({ id: req.params.id }).assign({ deleted: true }).write();
  res.json({ ok: true });
});

// PAGES
app.get("/signup", (req, res) => res.sendFile(path.join(__dirname, "public", "signup.html")));
app.get("/new", (req, res) => res.sendFile(path.join(__dirname, "public", "new.html")));
app.get("/profile", (req, res) => res.sendFile(path.join(__dirname, "public", "profile.html")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Kucingss on port " + PORT));
module.exports = app;
