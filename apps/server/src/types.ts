import { types } from 'mediasoup'
import { WebRtcTransport } from 'mediasoup/types'
import { Socket } from 'socket.io'

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
  getActiveSpeaker: () => string | undefined
  getRecentSpeakers: (limit?: number) => string[]
  addProducerToActiveSpeaker: (producer: types.Producer) => void
  updateActiveSpeakerList: (newDominantSpeakerId: string) => void
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

// TODO: Needs to be a sharable type so the frontend knows how the response is looking
export interface RecentSpeakerData {
  audioProducerId: string
  videoProducerId: string | null
  userName: string
  userId: string
}

export type JoinRoomAck = (response: {
  success: boolean
  routerCapabilities?: unknown
  error?: string
  recentSpeakersData?: Array<RecentSpeakerData | null>
}) => void

export type RequestTransportAck = (response: {
  success: boolean
  params?: ClientTransportParams
  error?: string
}) => void

export type ConnectTransportAck = (response: { success: boolean; error?: string }) => void

export type StartProducingAck = (response: {
  success: boolean
  id?: string
  error?: string
}) => void

export type StartConsumingAck = (response: {
  success: boolean
  id?: string
  rtpParameters?: types.RtpParameters
  error?: string
}) => void

export type ResumeConsumerAck = (response: { success: boolean; error?: string }) => void

export type ConsumeMediaAck = (response: {
  success: boolean
  error?: string
  params?: ClientConsumeMediaParams
}) => void
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
}

export interface WorkerPoolService {
  getWorkerForRoom(roomName: string): types.Worker
  getAvailableWorker(): types.Worker
  getAllWorkers(): types.Worker[]
  getWorkerStats(): Array<{ workerId: string; roomCount: number }>
}

// TODO: This type should be a sharable type since the frontend relys on it
export type RoleType = 'producer' | 'consumer'

export type NewProducersToConsumeData = {
  routerRtpCapabilities: types.RtpCapabilities
  recentSpeakersData: RecentSpeakerData[]
  activeSpeakerList: string[]
}

export interface ActiveSpeakerManager {
  setupActiveSpeakerHandling: (room: Room) => void
}
