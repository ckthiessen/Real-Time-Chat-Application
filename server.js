let express = require("express");
let app = express();
var favicon = require("serve-favicon");
let http = require("http").Server(app);
let io = require("socket.io")(http);
const { v4: uuidv4 } = require("uuid");
const path = require("path");

// Options for the time
const options = {
  timeZone: "America/Edmonton",
  hour12: true,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
};

var userCount = 0;
var messages = [];
var sessions = new Map();
var users = [];

app.use(express.static(path.join(__dirname, "public")));
app.use(favicon(path.join(__dirname, "public", "favicon.png")));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", socket => {
  userCount++;
  let username;
  let session;

  // Send joined event to client
  socket.emit("joined");

  // Send all messages to joined client
  socket.emit("get messages", messages);

  // Wait for client to send get session request
  socket.on("get session", id => {
    let sessionId;

    if (sessions.has(id)) {
      // If server already has session ID, return the session corresponding to that ID.
      sessionId = id;
      username = sessions.get(id).username;
      let color = sessions.get(id).color;

      session = {
        id,
        username,
        color
      };

      // Emit session back to client
      socket.emit("set session", session);
    } else {
      // Else, create a new session

      //Create default username
      username = "user" + userCount;

      // Create new session ID
      sessionId = uuidv4();

      session = {
        username,
        color: "black"
      };

      // Store session on server
      sessions.set(sessionId, session);

      // Emit session back to client
      socket.emit("set session", {
        id: sessionId,
        username: session.username,
        color: session.color
      });
    }
    // Send message to users that new user has joined
    let message = {
      text: username + " has joined the chat",
      username: "server",
      color: "000000", // Set color to black
      timeStamp: new Date().toLocaleTimeString("en-US", options),
      id: -1 // -1 is server ID
    };
    messages.push(message);
    io.emit("chat message", message);

    // If user not in user list, add them
    if (users.indexOf(username) == -1) {
      users.push(username);
    }

    // Emit list of users to all clients
    io.emit("set users", users);
  });

  // Wait for set username event
  socket.on("set username", request => {
    let sessionId = request.sessionId;
    let session = sessions.get(sessionId);

    let newUsername = request.newUsername;

    let usernameTaken = false;

    // Don't let the client choose the name "server"
    if (newUsername === "server") {
      usernameTaken = true;
    }

    // Check if the server already has a session with the new username
    sessions.forEach(session => {
      if (session.username === newUsername) {
        usernameTaken = true;
      }
    });

    // If username is taken, don't set the username and tell client to choose another username.
    if (usernameTaken) {
      let message = {
        text: "That name is already being used by another user. Please select a new username.",
        username: "server",
        color: "000000",
        timeStamp: new Date().toLocaleTimeString("en-US", options),
        id: -1
      };
      socket.emit("chat message", message);
      return;
    }

    let oldUsername = session.username;
    session.username = newUsername;

    // Emit the new username back to the client
    socket.emit("set username", newUsername);

    // Replace the the old username with the new username in the users list
    users[users.indexOf(oldUsername)] = newUsername;

    // Emit the list of users to all clients
    io.emit("set users", users);

    // Send message to all clients that user changed name
    let message = {
      text: oldUsername + " has changed their name to " + newUsername,
      username: "server",
      color: "000000", // Set color to black
      timeStamp: new Date().toLocaleTimeString("en-US", options),
      id: -1 // Server ID is -1
    };
    messages.push(message);
    io.emit("chat message", message);
  });

  // Wait for set color event
  socket.on("set color", request => {
    let sessionId = request.sessionId;
    let session = sessions.get(sessionId);

    let newColor = request.newColor;
    session.color = newColor;

    // Emit the new color back to the user
    io.emit("set color", { username: session.username, color: newColor });

    // Send message to all clients that user changed their color
    let message = {
      text: session.username + " has changed their color to " + newColor,
      username: "server",
      color: "000000", // Set color to black
      timeStamp: new Date().toLocaleTimeString("en-US", options),
      id: -1 // Server ID is -1
    };
    messages.push(message);
    io.emit("chat message", message);
  });

  // Wait for leave event
  socket.on("leave", sessionId => {
    let leavingUser = sessions.get(sessionId).username;

    // Remove leaving user from users list
    users.splice(users.indexOf(leavingUser), 1);

    userCount--;

    // Emit the user list to all clients
    io.emit("set users", users);

    // Send message to all clients that user left
    let message = {
      text: leavingUser + " has left the chat",
      username: "server",
      color: "000000", // Set message color to black
      timeStamp: new Date().toLocaleTimeString("en-US", options),
      id: -1 // Server ID is -1
    };

    messages.push(message);
    socket.broadcast.emit("chat message", message);
  });

  // Wait for chat message event
  socket.on("chat message", msg => {
    // Create time stamp
    msg.timeStamp = new Date().toLocaleTimeString("en-US", options);

    // Remember most recent 200 messages
    messages.length > 200
      ? () => {
          messages.shift();
          messages.push(msg);
        }
      : messages.push(msg);

    // Send message to all clients
    io.emit("chat message", msg);
  });
});

http.listen(3000, () => {
  console.log("Listening on port *:3000");
});
