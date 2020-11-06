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
var messages = [];
let users = new Map();
// let sessionIdLength = uuidv4().length();

app.use(express.static(path.join(__dirname, "public")));
app.use(favicon(path.join(__dirname, "public", "favicon.png"))); //Why won't this load?

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// function addUser() {
//   let sessionId = uuidv4();
//   username = "user" + ++userCount;
//   users.set(sessionId, { username, color: "black" });
//   console.log(users);
//   messages.push({
//     text: username + " has joined the chat",
//     username,
//     timeStamp: new Date().toLocaleTimeString("en-US", options)
//   });
// }

let username;
io.on("connection", socket => {
  let sessionId = uuidv4();
  username = "user" + ++userCount;
  users.set(sessionId, { username, color: "black" }); // Would like to use a UUID to create a session ID that will be stored in a cookie.
  console.log(users);
  messages.push({
    text: username + " has joined the chat",
    username,
    timeStamp: new Date().toLocaleTimeString("en-US", options)
  });
  // addUser();

  // Optimize so we aren't sending all messages every time
  // Should this be socket.emit or io.emit?
    // If I do io.emit then we are sending the entire chat history to every client unnecessarily when a new user connects
  io.emit("enter", {
    userCount,
    messages
  });

  socket.emit("set session", uuidv4());

  socket.emit("set username", username);

  // socket.on("set username", username => {
    
  // }

  // Optimize so we aren't sending all messages every time
  // socket.emit("enter", messages);

  console.log(username + " connected");

  socket.on("disconnect", () => {
    console.log(username + " disconnected");

    // users.delete(username);
    console.log(users);
    let message = {
      text: username + " has left the chat",
      username: username,
      timeStamp: new Date().toLocaleTimeString("en-US", options)
    };

    messages.push(message);

    userCount--;
    let event = {
      message,
      userCount
    };
    io.emit("leave", event);
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

// function addUser() {
//   // console.log(cookies.getAll());
  // if (users.has(document.cookie.substring( "sessionId=".length(), "sessionId=".length() + sessionIdLength))) {
//   //   console.log(document.cookie.substring( "sessionId=".length(), "sessionId=".length() + sessionIdLength));
//   //   return;
//   // }
//   let sessionId = uuidv4();
//   username = "user" + ++userCount;
//   users.set(sessionId, { username, color: "black" });
//   console.log(users);
//   messages.push({
//     text: username + " has joined the chat",
//     username,
//     timeStamp: new Date().toLocaleTimeString("en-US", options)
//   });
//   let obj = {
//     // sessionId: {
//       username,
//       color: "black"
//     // }
//   }
//   document.cookie = sessionId + "=" + JSON.stringify(obj) + ";max-age="+60*60*1000+";";
//   console.log(document.cookie);
// }