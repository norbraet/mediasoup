export const Role = {
  Producer: 'producer',
  Consumer: 'consumer',
} as const

export type RoleType = 'producer' | 'consumer'

export interface ClientTransportParams {
  id: string
  iceParameters: unknown
  iceCandidates: unknown
  dtlsParameters: unknown
}

export interface UserInfo {
  userId: string
  userName: string
  socketId?: string
}

export interface ClientState {
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
}
