/// <reference path="../typings/main.d.ts" />
try { require("source-map-support").install(); } catch (e) { /* empty */ }
import * as restify from "restify";
import * as socketIO from "socket.io";
let server = restify.createServer();
let io = socketIO.listen(server.server);
let sockets = new WeakMap<string, SocketIO.Socket>();

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

io.on("connect", socket => {
    socket.on("offer", ({targetId, sdp}) => {
    });
});

server.post("/api/offers", (req: restify.Request, res: restify.Response, next: restify.Next) => {
    let socket = sockets.get(req.params.targetId);
    if (socket == null) {
        res.send(404);
        return next();
    }
    socket.emit("offer", { srcId: req.params.srcId, sdp: req.params.sdp });
    res.send(201);
    return next();
});

server.post("/api/answers", (req: restify.Request, res: restify.Response, next: restify.Next) => {
    let socket = sockets.get(req.params.targetId);
    if (socket == null) {
        res.send(404);
        return next();
    }
    socket.emit("offer", { sdp: req.params.sdp });
    res.send(201);
    return next();
});

server.get("/api/:name", (req: restify.Request, res: restify.Response, next: restify.Next) => {
    res.send(req.params);
    return next();
});

server.get(/\/?.*/, restify.serveStatic({
    directory: "./lib/public",
    default: "index.html"
}));

server.listen(3000, () => {
    console.log("%s listening at %s", server.name, server.url);
});
