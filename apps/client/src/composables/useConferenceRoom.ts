import { readonly, ref } from 'vue'
import { useSocket } from './useSocket'
import type { RoomParticipant } from '../types/types'

export function useConferenceRoom() {
  const socket = useSocket()
  const currentRoom = ref<string | null>(null)
  const participants = ref<Map<string, RoomParticipant>>(new Map())
  const isJoining = ref(false)

  const joinRoom = async (userName: string, roomName: string) => {
    if (!socket.isConnected.value) {
      console.debug('Socket not connected, connecting...')
      await socket.connect()
    }
    isJoining.value = true
    const resp = await socket.getSocket().emitWithAck('join-room', { userName, roomName })
    console.debug('join-room - resp :>> ', resp)
  }

  const leaveRoom = () => {}

  return {
    // State
    currentRoom: readonly(currentRoom),
    participants: readonly(participants),
    socket,

    // Actions
    joinRoom,
    leaveRoom,
  }
}
