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
  <main class="container">
    <div role="group">
      <button @click="initConnect()">Init Connect</button>
      <button disabled="true" @click="deviceSetup()">Create & Load Device</button>
      <button disabled="true" @click="createProducer()">Create Producer Transport</button>
      <button disabled="true" @click="publish()">Publish</button>
      <button disabled="true" @click="createConsume()">Create Consumer Transport</button>
      <button disabled="true" @click="consume()">Subscribe to feed</button>
      <button disabled="true" @click="disconnect()">Disconnect</button>
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
