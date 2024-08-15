import type {
  SimplePeer as Peer,
  Instance as SimplePeerInstance,
  Options as SimplePeerOptions
} from 'simple-peer';

export type SimplePeer = SimplePeerInstance & {
  // add id to make debugging easier
  id: string;
};

export type SimplePeerInitMessage = {
  type: 'init';
  yourPeerId: string;
};
export type SimplePeerJoinMessage = {
  type: 'join';
  room: string;
};
export type SimplePeerJoinedMessage = {
  type: 'joined';
  otherPeerIds: string[];
};
export type SimplePeerSignalMessage = {
  type: 'signal';
  room: string;
  senderPeerId: string;
  receiverPeerId: string;
  data: string;
};
export type SimplePeerPingMessage = {
  type: 'ping';
};

export type PeerMessage =
  SimplePeerInitMessage |
  SimplePeerJoinMessage |
  SimplePeerJoinedMessage |
  SimplePeerSignalMessage |
  SimplePeerPingMessage;