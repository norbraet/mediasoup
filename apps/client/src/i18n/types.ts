export interface MessageSchema {
  common: {
    ok: string
    cancel: string
    close: string
    save: string
    loading: string
    error: string
  }

  controls: {
    audio: {
      mute: string
      unmute: string
      muted: string
    }
    video: {
      turnOn: string
      turnOff: string
      cameraOff: string
    }
    screenShare: {
      start: string
      stop: string
      stopLabel: string
      selectSource: string
    }
    recording: {
      start: string
      stop: string
      recording: string
    }
    leave: {
      label: string
      confirmTitle: string
      confirmMessage: string
    }
  }

  room: {
    title: string
    lobby: string
    joining: string
    left: string
    participants: string
  }

  participants: {
    you: string
    host: string
    guest: string
    muteAll: string
    remove: string
  }

  chat: {
    title: string
    placeholder: string
    send: string
    empty: string
  }

  status: {
    connecting: string
    connected: string
    reconnecting: string
    disconnected: string
  }

  permissions: {
    audioDenied: string
    videoDenied: string
    screenDenied: string
    instructions: string
  }

  errors: {
    roomNotFound: string
    roomFull: string
    network: string
    unknown: string
  }

  accessibility: {
    muteButton: string
    cameraButton: string
    screenShareButton: string
    leaveButton: string
  }
}

export type AvailableLocale = 'en' | 'de'
