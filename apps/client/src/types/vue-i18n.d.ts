import type { MessageSchema } from '../i18n/types'

declare module 'vue-i18n' {
  // Define the locale messages schema for global scope
  export interface DefineLocaleMessage extends MessageSchema {}
}
