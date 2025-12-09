<script setup lang="ts">
  const initConnect = () => {}

  const deviceSetup = () => {}

  const createProducer = () => {}

  const publish = () => {}

  const createConsume = () => {}

  const consume = () => {}

  const disconnect = () => {}
</script>

<template>
  <div class="container">
    <div class="">
      <button @click="initConnect()">Init Connect</button>
      <button disabled="true" @click="deviceSetup()">Create & Load Device</button>
      <button disabled="true" @click="createProducer()">Create Producer Transport</button>
      <button disabled="true" @click="publish()">Publish</button>
      <button disabled="true" @click="createConsume()">Create Consumer Transport</button>
      <button disabled="true" @click="consume()">Subscribe to feed</button>
      <button disabled="true" @click="disconnect()">Disconnect</button>
    </div>

    <div class="flex">
      <div>
        <h4>Local Media</h4>
        <video id="local-video" autoplay inline class="vid"></video>
      </div>
      <div>
        <h4>Consuming media</h4>
        <video id="remote-video" autoplay inline class="vid"></video>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .flex {
    display: flex;
    flex-direction: row;
    width: 100%;
    gap: 2rem;
  }

  .flex > div {
    width: 50%;
  }

  .vid {
    width: 100%;
    height: auto;
    max-height: 60vh;
    aspect-ratio: 16 / 9;
    background: #111;
    border-radius: 8px;
    object-fit: cover;
    border: 1px solid #333;
    overflow: hidden;
  }
</style>
