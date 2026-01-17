import { types } from 'mediasoup'
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

export interface Client {
  socketId: string
  userName: string
  roomId: string | null
  producerTransport: types.WebRtcTransport | null
  consumerTransports: Map<string, types.WebRtcTransport>
  producers: Map<string, types.Producer>
  consumers: Map<string, types.Consumer>
  setRoomId: (roomId: string) => void
  setProducerTransport: (transport: types.WebRtcTransport) => void
  addConsumerTransport: (transport: types.WebRtcTransport) => void
  removeConsumerTransport: (transportId: string) => void
  addProducer: (producer: types.Producer) => void
  addConsumer: (consumer: types.Consumer) => void
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
  addProducerToActiveSpeaker: (producer: types.Producer) => void
  cleanup: () => void
}

export interface RoomService {
  createRoom: (roomName: string) => Promise<Room>
  getRoomByName: (roomName: string) => Room | undefined
  getRoomById: (roomId: string) => Room | undefined
  removeRoom: (roomId: string) => void
  getAllRooms: () => Map<string, Room>
  getRoomStats: () => Array<{ roomName: string; clientCount: number; workerPid: string }>
}

export type JoinRoomAck = (response: {
  success: boolean
  routerCapabilities?: unknown
  producers?: Array<{
    id: string
    kind: string
    userId?: string
  }>
  error?: string
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

export interface RoomHandlers {
  'join-room': (data: { userName: string; roomName: string }, ack: JoinRoomAck) => Promise<void>
  'request-transport': (data: { type: RoleType }, ack: RequestTransportAck) => Promise<void>
  'connect-transport': (
    data: { dtlsParameters: types.DtlsParameters; type: RoleType },
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
}

export interface WorkerPoolService {
  getWorkerForRoom(roomName: string): types.Worker
  getAvailableWorker(): types.Worker
  getAllWorkers(): types.Worker[]
  getWorkerStats(): Array<{ workerId: string; roomCount: number }>
}

// TODO: This type should be a sharable type since the frontend relys on it
export type RoleType = 'producer' | 'consumer'
