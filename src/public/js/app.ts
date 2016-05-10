/// <reference path="../../../typings/browser.d.ts" />
import "babel-polyfill";
declare const RTCPeerConnection: any;
declare const RTCSessionDescription: any;
let socket = io();

async function main() {
    let params = getParams();
    let id = "_" + Math.random();
    if (params.get("peer") != null) {
        waitOffer(id);
    } else {
        offerUsingServer(id, params.get("peer"));
    }
}

function getParams() {
    let params = new Map<string, string>();
    let pair = location.search.substring(1).split("&");
    for (let i = 0; pair[i]; i++) {
        let kv = pair[i].split("=");
        params.set(kv[0], kv[1]);
    }
    return params;
}

function waitOffer(id: string) {
    socket.on("offer", async ({srcId, sdp: sdpInit}) => {
        let sdp = new RTCSessionDescription(sdpInit);
        if (sdp.type !== "offer") {
            return;
        }
        await receiveOffer(id, srcId, sdp);
    });
}

async function offerUsingServer(srcId: string, targetId: string) {
    let conn = new RTCPeerConnection({});
    let sdp = await conn.createOffer();
    conn.setLocalDescription(sdp);
    await fetch(
        `${location.origin}/api/offers`,
        {
            method: "POST",
            body: JSON.stringify({ srcId, targetId, sdp })
        });
    onceOrTimeout("answer");
}

async function receiveOffer(id: string, srcId: string, sdp: any) {
    let conn = new RTCPeerConnection({});
    await conn.setRemoteDescription(sdp);
    await answerUsingServer(conn, id, srcId);
}

async function answerUsingServer(conn: any, srcId: string, targetId: string) {
    let sdp = await conn.createAnswer();
    await conn.setLocalDescription(sdp);
    await fetch(
        `${location.origin}/api/answers`,
        {
            method: "POST",
            body: JSON.stringify({ srcId, targetId, sdp })
        });
}

function onceOrTimeout(event: string, ms: number) {
    return new Promise((resolve, reject) => {
        socket.once(event, callback);
        let timer = setTimeout(() => {
            socket.off(event, callback);
            reject();
        }, ms);

        function callback() {
            clearTimeout(timer);
            resolve();
        };
    });
}

let connectButton: any = null;
let disconnectButton: any = null;
let sendButton: any = null;
let messageInputBox: any = null;
let receiveBox: any = null;

let localConnection: any = null;   // RTCPeerConnection for our "local" connection
let remoteConnection: any = null;  // RTCPeerConnection for the "remote"

let sendChannel: any = null;       // RTCDataChannel for the local (sender)
let receiveChannel: any = null;    // RTCDataChannel for the remote (receiver)

function connectPeers() {
    localConnection = new RTCPeerConnection();

    // Create the data channel and establish its event listeners
    sendChannel = localConnection.createDataChannel("sendChannel");
    sendChannel.onopen = handleSendChannelStatusChange;
    sendChannel.onclose = handleSendChannelStatusChange;

    // Create the remote connection and its event listeners

    remoteConnection = new RTCPeerConnection();
    remoteConnection.ondatachannel = receiveChannelCallback;

    // Set up the ICE candidates for the two peers

    localConnection.onicecandidate = (e: any) => !e.candidate
        || remoteConnection.addIceCandidate(e.candidate)
            .catch(handleAddCandidateError);

    remoteConnection.onicecandidate = (e: any) => !e.candidate
        || localConnection.addIceCandidate(e.candidate)
            .catch(handleAddCandidateError);

    // Now create an offer to connect; this starts the process

    localConnection.createOffer()
        .then((offer: any) => localConnection.setLocalDescription(offer))
        .then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
        .then(() => remoteConnection.createAnswer())
        .then((answer: any) => remoteConnection.setLocalDescription(answer))
        .then(() => localConnection.setRemoteDescription(remoteConnection.localDescription))
        .catch(handleCreateDescriptionError);
}

// Handle errors attempting to create a description;
// this can happen both when creating an offer and when
// creating an answer. In this simple example, we handle
// both the same way.

function handleCreateDescriptionError(error: any) {
    console.log("Unable to create an offer: " + error.toString());
}


function handleAddCandidateError() {
    console.log("Oh noes! addICECandidate failed!");
}

// Handles clicks on the "Send" button by transmitting
// a message to the remote peer.

function sendMessage() {
    let message = messageInputBox.value;
    sendChannel.send(message);

    // Clear the input box and re-focus it, so that we're
    // ready for the next message.

    messageInputBox.value = "";
    messageInputBox.focus();
}

// Handle status changes on the local end of the data
// channel; this is the end doing the sending of data
// in this example.

function handleSendChannelStatusChange(event: any) {
    if (sendChannel) {
        let state = sendChannel.readyState;

        if (state === "open") {
            messageInputBox.disabled = false;
            messageInputBox.focus();
            sendButton.disabled = false;
            disconnectButton.disabled = false;
            connectButton.disabled = true;
        } else {
            messageInputBox.disabled = true;
            sendButton.disabled = true;
            connectButton.disabled = false;
            disconnectButton.disabled = true;
        }
    }
}

// Called when the connection opens and the data
// channel is ready to be connected to the remote.

function receiveChannelCallback(event: any) {
    receiveChannel = event.channel;
    receiveChannel.onmessage = handleReceiveMessage;
    receiveChannel.onopen = handleReceiveChannelStatusChange;
    receiveChannel.onclose = handleReceiveChannelStatusChange;
}

// Handle onmessage events for the receiving channel.
// These are the data messages sent by the sending channel.

function handleReceiveMessage(event: any) {
    let el = document.createElement("p");
    let txtNode = document.createTextNode(event.data);

    el.appendChild(txtNode);
    receiveBox.appendChild(el);
}

// Handle status changes on the receiver's channel.

function handleReceiveChannelStatusChange(event: any) {
    if (receiveChannel) {
        console.log("Receive channel's status has changed to " +
            receiveChannel.readyState);
    }

    // Here you would do stuff that needs to be done
    // when the channel's status changes.
}

// Close the connection, including data channels if they're open.
// Also update the UI to reflect the disconnected status.

function disconnectPeers() {

    // Close the RTCDataChannels if they're open.

    sendChannel.close();
    receiveChannel.close();

    // Close the RTCPeerConnections

    localConnection.close();
    remoteConnection.close();

    sendChannel = null;
    receiveChannel = null;
    localConnection = null;
    remoteConnection = null;

    // Update user interface elements

    connectButton.disabled = false;
    disconnectButton.disabled = true;
    sendButton.disabled = true;

    messageInputBox.value = "";
    messageInputBox.disabled = true;
}

main().catch(err => console.error(err));
