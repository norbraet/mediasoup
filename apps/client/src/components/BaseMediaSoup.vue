<script setup lang="ts">
  import { io, Socket } from 'socket.io-client'
  import { types, Device } from 'mediasoup-client'
  import { ref, computed, onUnmounted } from 'vue'
  import { env } from '../config/env'

  // --------------------
  // Globals
  // --------------------
  let socket: Socket | null,
    device: Device | null,
    localStream: MediaStream,
    producerTransport: types.Transport,
    producer: types.Producer,
    consumerTransport: types.Transport,
    consumer: types.Consumer

  // --------------------
  // UI / App State
  // --------------------
  const isConnecting = ref(false),
    isConnected = ref(false),
    deviceLoaded = ref(false),
    producerCreated = ref(false),
    isProducing = ref(false),
    consumerCreated = ref(false)

  const localVideo = ref<HTMLVideoElement | null>(null),
    remoteVideo = ref<HTMLVideoElement | null>(null)

  // --------------------
  // Derived button states
  // --------------------
  const canConnect = computed(() => !isConnecting.value && !isConnected.value),
    canSetupDevice = computed(() => isConnected.value && !deviceLoaded.value),
    canCreateProducer = computed(() => deviceLoaded.value && !producerCreated.value),
    canProduce = computed(() => producerCreated.value && !isProducing.value),
    canCreateConsumer = computed(() => deviceLoaded.value && !consumerCreated.value),
    canConsume = computed(() => consumerCreated.value),
    canDisconnect = computed(() => isConnected.value)

  // --------------------
  // Actions
  // --------------------
  const initConnect = () => {
    if (!canConnect.value) return

    isConnecting.value = true
    socket = io(env.VITE_API_URL)

    socket.on('connect', () => {
      console.log('Connected:', socket?.id)
      isConnecting.value = false
      isConnected.value = true
    })

    socket.on('disconnect', () => {
      console.log('Disconnected')
      resetState()
    })
  }

  const deviceSetup = async () => {
    if (!socket || deviceLoaded.value) return

    device = new Device()
    const routerRtpCapabilities = await socket.emitWithAck('getRtpCap')
    await device.load({ routerRtpCapabilities })

    deviceLoaded.value = true
  }

  const createProducer = async () => {
    if (!canCreateProducer.value || socket === null || device === null) return
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      if (localVideo.value) {
        localVideo.value.srcObject = localStream
        localVideo.value.play()
      }
    } catch (error) {
      console.log('GetUserMedia Error in createProducer() :>> ', error)
    }

    const transportOptions: types.TransportOptions = await socket.emitWithAck(
      'create-producer-transport'
    )
    producerTransport = device.createSendTransport(transportOptions)

    producerTransport.on(
      'connect',
      async ({ dtlsParameters: dtlsParameters }, callback, errback) => {
        if (socket === null) {
          console.error('Socket is null in connect event')
          errback(new Error('Socket disconnected'))
          return
        }

        try {
          console.log('Transport connect event has fired!')
          // TODO: shared typ nutzen
          const resp = await socket.emitWithAck('connect-transport', { dtlsParameters })
          console.log('resp :>> ', resp)

          if (resp === 'success') {
            callback()
          } else if (resp === 'error') {
            errback(new Error('Server responded with error'))
          } else {
            errback(new Error(`Unexpected response: ${resp}`))
          }
        } catch (error) {
          console.error('Error in connect event handler:', error)
          errback(error instanceof Error ? error : new Error('Unknown error'))
        }
      }
    )

    producerTransport.on('produce', async (parameters, callback, errback) => {
      if (socket === null) {
        console.error('Socket is null in produce event')
        errback(new Error('Socket disconnected'))
        return
      }

      try {
        const resp = await socket.emitWithAck('start-producing', parameters)
        console.log('resp :>> ', resp)
        if (resp === 'error') {
          errback(new Error('Server responded with error'))
        } else {
          callback({ id: resp })
        }
      } catch (error) {
        console.error('Error in produce event handler:', error)
        errback(error instanceof Error ? error : new Error('Unknown error'))
      }
    })

    producerCreated.value = true
  }

  const produce = async () => {
    if (!canProduce.value) return

    try {
      const track = localStream.getVideoTracks()[0]
      if (!track) {
        console.error('No video track available')
        return
      }

      producer = await producerTransport.produce({ track })
      console.log('producer :>> ', producer)

      // TODO: publish logic
      isProducing.value = true
    } catch (error) {
      console.error('Error in produce() :>> ', error)
    }
  }

  const createConsumer = async () => {
    if (!canCreateConsumer.value || socket === null || device === null) return

    const transportOptions: types.TransportOptions = await socket.emitWithAck(
      'create-consumer-transport'
    )
    consumerTransport = device.createRecvTransport(transportOptions)

    consumerTransport.on(
      'connect',
      async ({ dtlsParameters: dtlsParameters }, callback, errback) => {
        if (socket === null) {
          console.error('Socket is null in connect event')
          errback(new Error('Socket disconnected'))
          return
        }

        try {
          console.log('Transport connect event has fired!')
          // TODO: shared typ nutzen
          const resp = await socket.emitWithAck('connect-consumer-transport', { dtlsParameters })
          console.log('resp :>> ', resp)

          if (resp === 'success') {
            callback()
          } else if (resp === 'error') {
            errback(new Error('Server responded with error'))
          } else {
            errback(new Error(`Unexpected response: ${resp}`))
          }
        } catch (error) {
          console.error('Error in connect event handler:', error)
          errback(error instanceof Error ? error : new Error('Unknown error'))
        }
      }
    )

    consumerCreated.value = true
  }

  const consume = async () => {
    if (!canConsume.value || socket === null || device === null) return

    const consumerParams = await socket.emitWithAck('consume-media', {
      rtpCapabilities: device.rtpCapabilities,
    })

    console.debug('consumerParams :>> ', consumerParams)
    if (consumerParams === 'noProducer') {
      console.warn('There is no producer set up to consume')
    } else if (consumerParams === 'cannotConsume') {
      console.warn('rtpCapabilities failed. Cannot consume')
    } else {
      consumer = await consumerTransport.consume(consumerParams)
      if (remoteVideo.value) {
        remoteVideo.value.srcObject = new MediaStream([consumer.track])
        await socket.emitWithAck('unpause-consumer')
      }
    }
  }

  const disconnect = () => {
    if (!socket) return

    socket.disconnect()
    socket = null
    resetState()
  }

  const resetState = () => {
    isConnecting.value = false
    isConnected.value = false
    deviceLoaded.value = false
    producerCreated.value = false
    isProducing.value = false
    consumerCreated.value = false
    device = null
  }

  onUnmounted(disconnect)
</script>

<template>
  <main class="container">
    <div role="group" class="controls">
      <p class="connection-status" :class="{ connected: isConnected, disconnected: !isConnected }">
        {{ isConnected ? '🟢 Connected' : '🔴 Disconnected' }}
      </p>

      <button :disabled="!canConnect" @click="initConnect">
        {{ isConnecting ? 'Connecting…' : 'Init Connect' }}
      </button>

      <button :disabled="!canSetupDevice" @click="deviceSetup">Create & Load Device</button>

      <button :disabled="!canCreateProducer" @click="createProducer">
        Create Producer Transport
      </button>

      <button :disabled="!canProduce" @click="produce">Produce</button>

      <button :disabled="!canCreateConsumer" @click="createConsumer">
        Create Consumer Transport
      </button>

      <button :disabled="!canConsume" @click="consume">Subscribe to feed</button>

      <button :disabled="!canDisconnect" @click="disconnect">Disconnect</button>
    </div>

    <div class="flex">
      <section>
        <h2>Local Media</h2>
        <video ref="localVideo" autoplay playsinline class="vid"></video>
      </section>

      <section>
        <h2>Consuming media</h2>
        <video ref="remoteVideo" autoplay playsinline class="vid"></video>
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
