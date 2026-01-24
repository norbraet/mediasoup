import type { Socket } from 'socket.io-client'
import { ref } from 'vue'
import type { RoomParticipant } from '../../types/types'

export function useConferenceSocket(socket: Socket) {
  const joined = ref(false)
  const roomParticipants = ref<Map<string, RoomParticipant>>(new Map())

  const joinRoom = async (userName: string, roomName: string) => {
    const resp = await socket.emitWithAck('join-room', { userName, roomName })
    if (!resp.success) {
      throw new Error(resp.error || 'Failed to join room')
    }
    joined.value = true

    // Initialize participants map with current users from server
    if (resp.participants) {
      for (const participant of resp.participants) {
        roomParticipants.value.set(participant.userId, participant)
      }
    }

    return resp
  }

  const leaveRoom = () => {
    socket.emit('leave-room')

    // Cleanup
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
