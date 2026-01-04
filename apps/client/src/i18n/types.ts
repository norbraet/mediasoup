// Define the message schema interface
export interface MessageSchema {
  controls: {
    audio: {
      mute: string
      unmute: string
    }
    video: {
      turnOn: string
      turnOff: string
    }
    screenShare: {
      start: string
      stop: string
      stopLabel: string
    }
    recording: {
      start: string
      stop: string
    }
  }
  room: {
    title: string
  }
}

// Create a type for available locales
export type AvailableLocale = 'en' | 'de'
