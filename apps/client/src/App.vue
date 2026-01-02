<template>
  <div id="app">
    <!-- RouterView displays the component for the current route -->
    <router-view />
  </div>
</template>

<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    background: #f5f5f5;
  }

  #app {
    width: 100%;
    height: 100vh;
  }
</style>
