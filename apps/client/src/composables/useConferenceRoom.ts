import { readonly, ref } from 'vue'
import { useSocket } from './useSocket'
import { type CurrentProducer, type RoomParticipant } from '../types/types'
import { Device, types } from 'mediasoup-client'

export function useConferenceRoom() {
  const socket = useSocket()

  // Room
  const currentRoom = ref<string | null>(null)
  const participants = ref<Map<string, RoomParticipant>>(new Map())
  const isJoining = ref(false)
  const joinError = ref<string | null>(null)

  // Mediasoup
  const device = ref<Device | null>(null)
  const isDeviceReady = ref(false)
  const routerCapabilities = ref<types.RtpCapabilities | null>(null)
  const currentProducers = ref<CurrentProducer[]>([])

  const joinRoom = async (userName: string, roomName: string) => {
    try {
      // 1. Connect to server if not connected
      if (!socket.isConnected.value) {
        console.debug('Socket not connected, connecting...')
        await socket.connect()
      }
      isJoining.value = true

      // 2. Join the room and get router capabilities
      console.debug('Joining room...')
      const resp = await socket.getSocket().emitWithAck('join-room', { userName, roomName })
      console.debug('join-room - resp :>> ', resp)

      if (!resp.success) {
        throw new Error(resp.error || 'Failed to join room')
      }

      // 3. Create and load device
      console.debug('Creating mediasoup device...')
      const newDevice = new Device()
      await newDevice.load({
        routerRtpCapabilities: resp.routerCapabilities,
      })

      // 4. Update the state
      device.value = newDevice
      isDeviceReady.value = true
      routerCapabilities.value = resp.routerCapabilities
      currentRoom.value = roomName
      currentProducers.value = resp.producers || []
    } catch (error) {
      console.error('Failed to join room:', error)
      joinError.value = error instanceof Error ? error.message : 'Failed to join room'

      // Cleanup on error
      device.value = null
      isDeviceReady.value = false
      currentRoom.value = null

      throw error
    } finally {
      isJoining.value = false
    }
  }

  const leaveRoom = () => {
    if (socket.getSocket() && currentRoom.value) {
      socket.getSocket().emit('leave-room')

      // Reset all state
      device.value = null
      isDeviceReady.value = false
      routerCapabilities.value = null
      currentRoom.value = null
      currentProducers.value = []
      participants.value.clear()
      joinError.value = null

      console.debug('Left room and cleaned up device')
    }
  }

  return {
    // Room State
    currentRoom: readonly(currentRoom),
    participants: readonly(participants),
    isJoining: readonly(isJoining),
    joinError: readonly(joinError),

    // WebRTC state
    device: readonly(device),
    isDeviceReady: readonly(isDeviceReady),
    routerCapabilities: readonly(routerCapabilities),
    currentProducers: readonly(currentProducers),

    // Socket state
    isConnected: socket.isConnected,
    isConnecting: socket.isConnecting,
    socket,

    // Actions
    joinRoom,
    leaveRoom,
  }
}
