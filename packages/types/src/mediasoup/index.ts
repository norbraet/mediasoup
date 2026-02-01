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
