export interface RoomParticipant {
  id: string
  userName: string
  hasVideo: boolean
  hasAudio: boolean
}

export interface CurrentProducer {
  id: string
  kind: 'audio' | 'video'
  userId: string
}
