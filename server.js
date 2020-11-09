let express = require("express");
let app = express();
var favicon = require("serve-favicon");
let http = require("http").Server(app);
let io = require("socket.io")(http);
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const options = {
  timeZone: "America/Edmonton",
  hour12: true,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
};

var userCount = 0;
var messages = []; // This object should contain the sessionID instead of the username cause username can change and session ID can be used to track their color changes but username can't (for previous reason)
var sessions = new Map();
var users = [];

app.use(express.static(path.join(__dirname, "public")));
app.use(favicon(path.join(__dirname, "public", "favicon.png"))); //Why won't this load?

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", socket => {
  let username;
  let session;
  io.emit("joined", null);

  socket.on("get session", id => {
    if (sessions.has(id)) {
      console.log(id);

      username = sessions.get(id).username;
      let color = sessions.get(id).color;

      session = {
        id,
        username,
        color
      };

      socket.emit("set session", session);
    } else {
      username = "user" + ++userCount;

      let sessionId = uuidv4();

      session = {
        username,
        color: "black"
      };

      sessions.set(sessionId, session); // Would like to use a UUID to create a session ID that will be stored in a cookie.

      socket.emit("set session", {
        id: sessionId,
        username: session.username,
        color: session.color
      });
    }
    console.log(username + " connected");
    console.log(sessions);
    users.push(username);
    messages.push({
      text: username + " has joined the chat",
      username,
      timeStamp: new Date().toLocaleTimeString("en-US", options)
    });
  });

  // Optimize so we aren't sending all messages every time
  // Should this be socket.emit or io.emit?
  // If I do io.emit then we are sending the entire chat history to every client unnecessarily when a new user connects

  socket.on("set username", request => {
    let sessionId = request.sessionId;
    let session = sessions.get(sessionId);

    let newUsername = request.newUsername;
    // Check if the server already has a session with the new username
    if (sessions.some(session => session.username === newUsername)) {
      // Need to test
      let message = {
        text: "That name is already being used by another user. Please select a new username.",
        id: "server",
        timeStamp: new Date().toLocaleTimeString("en-US", options)
      };
      socket.emit("chat message", message);
      return;
    }
    let oldUsername = session.username;
    session.username = newUsername;

    socket.emit("set username", newUsername);

    let message = {
      text: oldUsername + " has changed their name to " + newUsername,
      id: sessionId,
      timeStamp: new Date().toLocaleTimeString("en-US", options)
    };
    socket.emit("chat message", message);
  });

  socket.on("set color", request => {
    let sessionId = request.sessionId;
    let session = sessions.get(sessionId);

    let newColor = request.newColor;
    session.color = newColor;
    console.log(sessions);

    socket.emit("set color", newColor);
  });

  socket.on("disconnect", () => {
    console.log(session + " disconnected");

    let message = {
      text: sessions.get(session).username + " has left the chat",
      id: session.id,
      timeStamp: new Date().toLocaleTimeString("en-US", options)
    };

    sessions.delete(session);
    console.log("Sessions after leaving: \n" + sessions);

    messages.push(message);
    socket.broadcast.emit("chat message", message);

    io.emit("leave", --userCount);
  });

  socket.on("chat message", msg => {
    console.log(msg);
    // Remember most recent 200 messages
    msg.timeStamp = new Date().toLocaleTimeString("en-US", options);
    messages.length > 200
      ? () => {
          messages.shift();
          messages.push(msg);
        }
      : messages.push(msg);

    // If use socket.broadcast.emit then client won't get the timestamp
    io.emit("chat message", msg);
  });
});

http.listen(3000, () => {
  console.log("Listening on port localhost:3000");
});
