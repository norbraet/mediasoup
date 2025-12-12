<script setup lang="ts">
  import { io, Socket } from 'socket.io-client'
  import { ref, onUnmounted } from 'vue'
  import { env } from '../config/env'

  let socket: Socket | null = null
  const isConnected = ref(false)

  const initConnect = () => {
    socket = io(env.VITE_WS_URL, {
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      console.log('Connected to server:', socket?.id)
      isConnected.value = true
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from server')
      isConnected.value = false
    })

    // Add your mediasoup-specific socket listeners here
    socket.on('routerRtpCapabilities', (data) => {
      console.log('Received router RTP capabilities:', data)
      // Handle router capabilities
    })

    // Add more socket listeners as needed for your mediasoup implementation
  }

  const deviceSetup = () => {
    // Your device setup logic here
  }

  const createProducer = () => {
    // Your create producer logic here
  }

  const publish = () => {
    // Your publish logic here
  }

  const createConsume = () => {
    // Your create consume logic here
  }

  const consume = () => {
    // Your consume logic here
  }

  const disconnect = () => {
    if (socket) {
      socket.disconnect()
      socket = null
      isConnected.value = false
    }
  }

  // Clean up socket connection when component is unmounted
  onUnmounted(() => {
    disconnect()
  })
</script>

<template>
  <main class="container">
    <div role="group" class="controls">
      <div class="connection-status">
        <span :class="{ connected: isConnected, disconnected: !isConnected }">
          {{ isConnected ? '🟢 Connected' : '🔴 Disconnected' }}
        </span>
      </div>
      <button :disabled="isConnected" @click="initConnect()">Init Connect</button>
      <button :disabled="!isConnected" @click="deviceSetup()">Create & Load Device</button>
      <button :disabled="!isConnected" @click="createProducer()">Create Producer Transport</button>
      <button :disabled="!isConnected" @click="publish()">Publish</button>
      <button :disabled="!isConnected" @click="createConsume()">Create Consumer Transport</button>
      <button :disabled="!isConnected" @click="consume()">Subscribe to feed</button>
      <button :disabled="!isConnected" @click="disconnect()">Disconnect</button>
    </div>

    <div class="flex">
      <section>
        <h2>Local Media</h2>
        <video id="local-video" autoplay playsinline class="vid"></video>
      </section>
      <section>
        <h2>Consuming media</h2>
        <video id="remote-video" autoplay playsinline class="vid"></video>
      </section>
    </div>
  </main>
</template>

<style scoped>
  .controls {
    margin-bottom: 2rem;
  }

  .connection-status {
    margin-bottom: 1rem;
    font-weight: bold;
  }

  .connected {
    color: #22c55e;
  }

  .disconnected {
    color: #ef4444;
  }

  button {
    margin: 0.25rem;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: 1px solid #ccc;
    background: #f9f9f9;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button:not(:disabled):hover {
    background: #e9e9e9;
  }

  .container {
    margin: 0 auto;
    max-width: 1400px;
    padding: 2rem;
  }

  .flex {
    display: flex;
    flex-direction: row;
    width: 100%;
    gap: 2rem;
    margin-top: 1rem;
  }

  .flex > section {
    width: 50%;
  }

  .vid {
    width: 100%;
    height: auto;
    max-height: 60vh;
    aspect-ratio: 16 / 9;
    background: #0f0f0f;
    border-radius: 8px;
    object-fit: cover;
    border: 1px solid #333;
    overflow: hidden;
    margin-top: 1rem;
  }

  button:hover {
    background-color: #4a4a4a;
  }

  a {
    font-weight: 500;
    color: #646cff;
    text-decoration: none;
  }

  a:hover {
    color: #535bf2;
  }
</style>
