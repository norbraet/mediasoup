/// <reference types="vite/client" />

import type { DefineComponent } from 'vue'

declare module '*.vue' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<{}, {}, any>
  export default component
}
