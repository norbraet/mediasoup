import type { MessageSchema } from '../i18n/types'

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}
