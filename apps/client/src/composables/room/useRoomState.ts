import { ref } from 'vue'
import type { RoomParticipant } from '../../types/types'

export function useRoomState() {
  const currentRoom = ref<string | null>(null)
  const participants = ref<Map<string, RoomParticipant>>(new Map())
  const isJoining = ref(false)
  const joinError = ref<string | null>(null)

  const resetRoom = () => {
    currentRoom.value = null
    participants.value.clear()
    joinError.value = null
    isJoining.value = false
  }

  return {
    currentRoom,
    participants,
    isJoining,
    joinError,
    resetRoom,
  }
}
