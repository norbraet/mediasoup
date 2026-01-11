import { readonly, ref } from 'vue'
import { io, Socket } from 'socket.io-client'
import { env } from '../config/env'

export function useSocket() {
  let socket: Socket | null = null
  const isConnected = ref(false)
  const isConnecting = ref(false)

  const connect = async (): Promise<Socket> => {
    if (socket) return socket

    isConnecting.value = true

    return new Promise((resolve, reject) => {
      socket = io(env.VITE_API_URL)

      socket.on('connect', () => {
        isConnected.value = true
        isConnecting.value = false
        console.debug('Connected:', socket!.id)
        resolve(socket!)
      })

      socket.on('disconnect', () => {
        console.debug('Disconnected from the socket')
        isConnected.value = false
      })

      socket.on('connect_error', (error) => {
        isConnecting.value = false
        reject(error)
      })
    })
  }

  const disconnect = () => {
    socket?.disconnect()
    socket = null
    isConnected.value = false
  }

  const getSocket = (): Socket => {
    if (!socket) throw new Error('Socket not connected. Call connect() first')
    return socket
  }

  return {
    connect,
    disconnect,
    getSocket,
    isConnected: readonly(isConnected),
    isConnecting: readonly(isConnecting),
  }
}
