<script setup lang="ts">
  import { io, Socket } from 'socket.io-client'
  import { ref, onUnmounted, useTemplateRef } from 'vue'
  import { env } from '../config/env'

  let socket: Socket | null = null
  const isConnected = ref(false)

  const connectButton = useTemplateRef<HTMLButtonElement>('connectButton')
  const deviceSetupButton = useTemplateRef<HTMLButtonElement>('deviceSetupButton')
  const createProducerButton = useTemplateRef<HTMLButtonElement>('createProducerButton')
  const publishButton = useTemplateRef<HTMLButtonElement>('publishButton')
  const createConsumeButton = useTemplateRef<HTMLButtonElement>('createConsumeButton')
  const consumeButton = useTemplateRef<HTMLButtonElement>('consumeButton')
  const disconnectButton = useTemplateRef<HTMLButtonElement>('disconnectButton')

  const initConnect = () => {
    socket = io(env.VITE_WS_URL, {
      transports: ['websocket', 'polling'],
    })

    if (connectButton.value) connectButton.value.innerHTML = 'Connecting...'

    socket.on('connect', () => {
      console.log('Connected to server:', socket?.id)
      if (connectButton.value && deviceSetupButton.value) {
        connectButton.value.innerHTML = 'Connected'
        connectButton.value.disabled = true
        deviceSetupButton.value.disabled = false
      }

      isConnected.value = true
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from server')
      isConnected.value = false
    })

    socket.on('routerRtpCapabilities', (data) => {
      console.log('Received router RTP capabilities:', data)
      // Handle router capabilities
    })
  }

  const deviceSetup = () => {
    // TODO: Device setup logic here
  }

  const createProducer = () => {
    // TODO: Create producer logic here
  }

  const publish = () => {
    // TODO: Publish logic here
  }

  const createConsume = () => {
    // TODO: Create consume logic here
  }

  const consume = () => {
    // TODO: Consume logic here
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
      <p class="connection-status" :class="{ connected: isConnected, disconnected: !isConnected }">
        {{ isConnected ? '🟢 Connected' : '🔴 Disconnected' }}
      </p>
      <button ref="connectButton" :disabled="isConnected" @click="initConnect()">
        Init Connect
      </button>
      <button ref="deviceSetupButton" :disabled="!isConnected" @click="deviceSetup()">
        Create & Load Device
      </button>
      <button ref="createProducerButton" :disabled="!isConnected" @click="createProducer()">
        Create Producer Transport
      </button>
      <button ref="publishButton" :disabled="!isConnected" @click="publish()">Publish</button>
      <button ref="createConsumeButton" :disabled="!isConnected" @click="createConsume()">
        Create Consumer Transport
      </button>
      <button ref="consumeButton" :disabled="!isConnected" @click="consume()">
        Subscribe to feed
      </button>
      <button ref="disconnectButton" :disabled="!isConnected" @click="disconnect()">
        Disconnect
      </button>
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
  button {
    margin: 0.25rem;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: 1px solid #ccc;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button:not(:disabled):hover {
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
</style>
