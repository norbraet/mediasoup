import { types } from 'mediasoup'
import { WebRtcTransport } from 'mediasoup/types'
import { Socket } from 'socket.io'
import type {
  ConnectTransportResponse,
  ConsumeMediaResponse,
  JoinRoomResponse,
  RecentSpeakerData,
  RequestTransportResponse,
  ResumeConsumerResponse,
  RoleType,
  SendChatMessageData,
  StartProducingResponse,
} from '@mediasoup/types'

export type ClientProducingParams = Pick<
  types.ProducerOptions,
  'kind' | 'rtpParameters' | 'appData'
>

export type ClientTransportParams =
  | {
      id: string
      iceParameters: types.IceParameters
      iceCandidates: types.IceCandidate[]
      dtlsParameters: types.DtlsParameters
    }
  | { error: string }

export type ClientConsumeMediaParams = {
  producerId: string
  id: string
  kind: types.MediaKind
  rtpParameters: types.RtpParameters
}

export interface MediasoupService {
  getRouterRtpCapabilities(): types.RtpCapabilities
  createWebRtcTransport(): Promise<{
    transport: types.WebRtcTransport
    clientTransportParams: ClientTransportParams
  }>
  addProducer(producer: types.Producer): void
  getCurrentProducer(): types.Producer | null
  canConsume(producerId: string, rtpCapabilities: types.RtpCapabilities): boolean
  getRouter(): types.Router
}

export type ConsumerTransport = {
  transport: WebRtcTransport
  associatedAudioProducerId: string
  associatedVideoProducerId: string | null
  audio?: types.Consumer
  video?: types.Consumer
}

export interface Client {
  socketId: string
  userName: string
  roomId: string | null
  producerTransport: types.WebRtcTransport | null
  consumerTransports: Map<string, ConsumerTransport>
  producers: Map<string, types.Producer>
  setRoomId: (roomId: string) => void
  setProducerTransport: (transport: types.WebRtcTransport) => void
  addConsumerTransport: (
    transport: types.WebRtcTransport,
    audioProducerId: string,
    videoProducerId: string | null
  ) => void
  removeConsumerTransport: (transportId: string) => void
  addProducer: (producer: types.Producer) => void
  addConsumer: (
    consumer: types.Consumer,
    kind: types.MediaKind,
    transport: types.WebRtcTransport
  ) => void
  cleanup: () => void
}

export interface ClientService {
  createClient: (socket: Socket, userName: string) => Client
  getClientBySocketId: (socketId: string) => Client | undefined
  getClientByProducerId: (producerId: string) => Client | undefined
  removeClient: (socketId: string) => void
  getAllClients: () => Map<string, Client>
}

export interface Room {
  id: string
  name: string
  router: types.Router
  worker: types.Worker
  clients: Map<string, Client>
  activeSpeakerObserver: types.ActiveSpeakerObserver
  addClient: (client: Client) => void
  removeClient: (clientId: string) => void
  getProducers: () => types.Producer[]
  getClientCount: () => number
  // getActiveSpeaker: () => string | undefined
  getRecentSpeakers: (limit?: number) => string[]
  addProducerToActiveSpeaker: (producer: types.Producer) => void
  updateActiveSpeakerList: (newDominantSpeakerId: string) => void
  getAllParticipantsForNewJoiner: (limit: number) => string[]
  cleanup: () => void
}

export interface RoomService {
  createRoom: (roomName: string, clientService: ClientService, socket: Socket) => Promise<Room>
  getRoomByName: (roomName: string) => Room | undefined
  getRoomById: (roomId: string) => Room | undefined
  removeRoom: (roomId: string) => void
  getAllRooms: () => Map<string, Room>
  getRoomStats: () => Array<{ roomName: string; clientCount: number; workerPid: string }>
}

export type JoinRoomAck = (response: JoinRoomResponse) => void
export type RequestTransportAck = (response: RequestTransportResponse) => void
export type ConnectTransportAck = (response: ConnectTransportResponse) => void
export type StartProducingAck = (response: StartProducingResponse) => void
export type StartConsumingAck = (response: StartProducingResponse) => void // TODO: Kann raus?
export type ResumeConsumerAck = (response: ResumeConsumerResponse) => void
export type ConsumeMediaAck = (response: ConsumeMediaResponse) => void
export interface RoomHandlers {
  'join-room': (data: { userName: string; roomName: string }, ack: JoinRoomAck) => Promise<void>
  'request-transport': (
    data: { type: RoleType; audioProducerId?: string },
    ack: RequestTransportAck
  ) => Promise<void>
  'connect-transport': (
    data: { dtlsParameters: types.DtlsParameters; type: RoleType; audioProducerId?: string },
    ack: ConnectTransportAck
  ) => Promise<void>
  'start-producing': (
    parameters: {
      kind: types.MediaKind
      rtpParameters: types.RtpParameters
      appData?: types.AppData
    },
    ack: StartProducingAck
  ) => Promise<void>
  'audio-muted': (data: { isAudioMuted: boolean }) => void
  'consume-media': (
    data: { rtpCapabilities: types.RtpCapabilities; producerId: string; kind: types.MediaKind },
    acknowledgement: ConsumeMediaAck
  ) => Promise<void>
  'unpause-consumer': (
    data: { producerId: string; kind: types.MediaKind },
    acknowledgement: ResumeConsumerAck
  ) => Promise<void>
  'leave-room': () => Promise<void>
  'video-toggled': (data: { isVideoEnabled: boolean }) => void
  'chat-message': (data: SendChatMessageData) => void
}

export interface WorkerPoolService {
  getWorkerForRoom(roomName: string): types.Worker
  getAvailableWorker(): types.Worker
  getAllWorkers(): types.Worker[]
  getWorkerStats(): Array<{ workerId: string; roomCount: number }>
}

export type NewProducersToConsumeData = {
  routerRtpCapabilities: types.RtpCapabilities
  recentSpeakersData: RecentSpeakerData[]
  activeSpeakerList: string[]
}

export interface ActiveSpeakerManager {
  setupActiveSpeakerHandling: (room: Room) => void
}

export type ClientRoomContext = {
  client: Client
  room: Room
}
