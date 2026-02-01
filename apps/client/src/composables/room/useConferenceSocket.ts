import type { Socket } from 'socket.io-client'
import { ref } from 'vue'
import type { RoomParticipant } from '../../types/types'
import { SOCKET_EVENTS, type JoinRoomRequest } from '@mediasoup/types'

export function useConferenceSocket(socket: Socket) {
  const joined = ref(false)
  const roomParticipants = ref<Map<string, RoomParticipant>>(new Map())

  const joinRoom = async (userName: string, roomName: string) => {
    // TODO: TYPES join-room
    const payload: JoinRoomRequest = {
      userName,
      roomId: roomName,
    }
    const resp = await socket.emitWithAck(SOCKET_EVENTS.JOIN_ROOM, payload)
    if (!resp.success) {
      throw new Error(resp.error || 'Failed to join room')
    }
    joined.value = true

    if (resp.participants) {
      for (const participant of resp.participants) {
        roomParticipants.value.set(participant.userId, participant)
      }
    }

    return resp
  }

  const leaveRoom = () => {
    // TODO: TYPES leave-room
    socket.emit(SOCKET_EVENTS.LEAVE_ROOM)

    joined.value = false
    roomParticipants.value.clear()
  }

  return {
    joined,
    roomParticipants,
    joinRoom,
    leaveRoom,
  }
}
