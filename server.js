const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", credentials: true } });

// Static folders
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

// Uploads folder
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + "-" + file.originalname.replace(/[^\w\.-]/g, "_");
    cb(null, safe);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

// Upload endpoint
app.post("/upload", upload.array("files", 10), (req, res) => {
  const files = (req.files || []).map((f) => ({
    url: `/uploads/${f.filename}`,
    name: f.originalname,
    mimetype: f.mimetype,
    size: f.size,
  }));
  res.json({ files });
});

const users = {}; // track active users

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // User joins
  socket.on("user:join", (name) => {
    users[socket.id] = name || "Anon";
    io.emit("active-users", Object.values(users));
  });

  // Chat messages
  socket.on("chat:send", (payload) => {
    const senderName = users[socket.id] || "Anon";
    const data = {
      ...payload,
      senderName,
      senderId: socket.id,
      time: Date.now(),
    };
    io.emit("chat:receive", data);
  });

  // Message seen
  socket.on("chat:seen", ({ msgId, senderId }) => {
    io.to(senderId).emit("chat:seen:update", { msgId, at: Date.now() });
  });

  // Disconnect
  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("active-users", Object.values(users));
    console.log("Disconnected:", socket.id);
  });
});

const PORT = 106;
server.listen(PORT, () =>
  console.log(`Server running → http://localhost:${PORT}`)
);
