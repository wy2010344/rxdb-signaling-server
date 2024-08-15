import WebSocket from 'ws';
import { PeerMessage } from './PeerMessage';
import { getFromMapOrCreate } from './util-map';

/**
 * 参考
 * https://github.com/pubkey/rxdb/blob/master/src/plugins/replication-webrtc/signaling-server.ts
 * 
 * nginx配置如常
 * 
location /webrtc {
  # First attempt to serve request as file, then
  # as directory, then fall back to displaying a 404.
  proxy_pass http://localhost:5183; #whatever port your app runs on
  proxy_http_version 1.1;

  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection 'upgrade';
  proxy_set_header Host $host;
  proxy_cache_bypass $http_upgrade;
}
客户端调用wss://ss.ccc.vvv/webrtc
 */

const COUCH_NAME_CHARS = 'abcdefghijklmnopqrstuvwxyz';
function randomCouchString(length: number = 10): string {
  let text = '';
  for (let i = 0; i < length; i++) {
    text += COUCH_NAME_CHARS.charAt(Math.floor(Math.random() * COUCH_NAME_CHARS.length));
  }
  return text;
}

const port = 5183

// 创建一个 WebSocket 服务器实例
const wss = new WebSocket.Server({ port });
type ServerPeer = {
  id: string;
  socket: WebSocket;
  rooms: Set<string>;
  lastPing: number;
};

const peerById = new Map<string, ServerPeer>();
const peersByRoom = new Map<string, Set<string>>();
export const PEER_ID_LENGTH = 12;
function sendMessage(ws: WebSocket, message: PeerMessage) {
  const msgString = JSON.stringify(message);
  ws.send(msgString);
}
function disconnectSocket(peerId: string, reason: string) {
  console.log('# disconnect peer ' + peerId + ' reason: ' + reason);
  const peer = peerById.get(peerId);
  if (peer) {
    peer.socket.close && peer.socket.close(undefined, reason);
    peer.rooms.forEach(roomId => {
      const room = peersByRoom.get(roomId);
      room?.delete(peerId);
      if (room && room.size === 0) {
        peersByRoom.delete(roomId);
      }
    });
  }
  peerById.delete(peerId);
}

/**
 * 是否是合法的room-id
 */
function validateIdString(roomId: string): boolean {
  if (
    typeof roomId === 'string' &&
    roomId.length > 5 &&
    roomId.length < 100
  ) {
    return true;
  } else {
    return false;
  }
}
wss.on('connection', function (ws) {
  /**
   * PeerID is created by the server to prevent malicious
   * actors from falsy claiming other peoples ids.
   */
  const peerId = randomCouchString(PEER_ID_LENGTH);
  const peer: ServerPeer = {
    id: peerId,
    socket: ws,
    rooms: new Set(),
    lastPing: Date.now()
  };
  peerById.set(peerId, peer);

  sendMessage(ws, { type: 'init', yourPeerId: peerId });


  ws.on('error', err => {
    console.error('SERVER ERROR:');
    console.dir(err);
    disconnectSocket(peerId, 'socket errored');
  });
  ws.on('close', () => {
    disconnectSocket(peerId, 'socket disconnected');
  });

  ws.on('message', msgEvent => {
    peer.lastPing = Date.now();
    const message = JSON.parse(msgEvent.toString()) as PeerMessage;
    const type = message.type;
    switch (type) {
      case 'join':
        const roomId = message.room;
        if (
          !validateIdString(roomId) ||
          !validateIdString(peerId)
        ) {
          disconnectSocket(peerId, 'invalid ids');
          return;
        }

        if (peer.rooms.has(peerId)) {
          return;
        }
        peer.rooms.add(roomId);


        const room = getFromMapOrCreate(
          peersByRoom,
          message.room,
          () => new Set()
        );

        room.add(peerId);

        // tell everyone about new room state
        room.forEach(otherPeerId => {
          const otherPeer = peerById.get(otherPeerId);
          if (otherPeer) {
            sendMessage(
              otherPeer.socket,
              {
                type: 'joined',
                otherPeerIds: Array.from(room)
              }
            );
          }
        });
        break;
      case 'signal':
        if (
          message.senderPeerId !== peerId
        ) {
          disconnectSocket(peerId, 'spoofed sender');
          return;
        }
        const receiver = peerById.get(message.receiverPeerId);
        if (receiver) {
          sendMessage(
            receiver.socket,
            message
          );
        }
        break;
      case 'ping':
        break;
      default:
        disconnectSocket(peerId, 'unknown message type ' + type);
    }
  });
});


console.log(`WebSocket server is running on ws://localhost:${port}`);
