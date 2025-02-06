require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const Message = require("./models/Message"); // Import Message model

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Connection Error:", err));

// Socket.io Events
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Join Room
  socket.on("joinRoom", (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
    io.to(room).emit("message", {
      user: "Admin",
      message: `A new user has joined the room: ${room}`,
    });
  });

  // Leave Room
  socket.on("leaveRoom", (room) => {
    socket.leave(room);
    console.log(`User ${socket.id} left room: ${room}`);
  });

  // Send Message
  socket.on("sendMessage", async ({ room, message, user }) => {
    // Save message to MongoDB
    const newMessage = new Message({ room, user, message });
    await newMessage.save();

    // Emit message to the specified room only
    io.to(room).emit("message", { user, message });
  });

  // Typing Indicator
  socket.on("typing", ({ room, user }) => {
    socket.to(room).emit("typing", user);
  });

  socket.on("stopTyping", (room) => {
    socket.to(room).emit("stopTyping");
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// API to Retrieve Messages for a Room
app.get("/api/messages/:room", async (req, res) => {
  try {
    const { room } = req.params;
    const messages = await Message.find({ room }).sort({ timestamp: 1 });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving messages", error });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
