import { ref } from 'vue'

export function useMediaState() {
  const localStream = ref<MediaStream | null>(null)
  const localVideoRef = ref<HTMLVideoElement>()
  const isVideoEnabled = ref(false)
  const isAudioEnabled = ref(false)
  const isAudioMuted = ref(false)
  const isGettingMedia = ref(false)
  const mediaError = ref<string | null>(null)

  const screenStream = ref<MediaStream | null>(null)
  const isScreenSharing = ref(false)

  const startAudio = async (): Promise<MediaStream> => {
    isGettingMedia.value = true
    mediaError.value = null

    try {
      console.groupCollapsed('Getting user audio...')

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      })

      localStream.value = stream

      const audioTrack = stream.getAudioTracks()[0]

      isAudioEnabled.value = !!audioTrack?.enabled
      isVideoEnabled.value = false
      isAudioMuted.value = false

      return stream
    } catch (error) {
      console.error('Failed to get user audio:', error)
      mediaError.value = error instanceof Error ? error.message : 'Failed to access microphone'
      throw error
    } finally {
      isGettingMedia.value = false
      console.groupEnd()
    }
  }

  const startVideo = async (): Promise<MediaStream> => {
    isGettingMedia.value = true
    mediaError.value = null

    try {
      console.groupCollapsed('Getting user video + audio...')

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })

      localStream.value = stream

      if (localVideoRef.value) {
        localVideoRef.value.srcObject = null
        localVideoRef.value.srcObject = stream
      }

      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()[0]

      isVideoEnabled.value = !!videoTrack?.enabled
      isAudioEnabled.value = !!audioTrack?.enabled
      isAudioMuted.value = false

      return stream
    } catch (error) {
      console.error('Failed to get user media:', error)
      mediaError.value = error instanceof Error ? error.message : 'Failed to access camera/mic'
      throw error
    } finally {
      isGettingMedia.value = false
      console.groupEnd()
    }
  }

  const startScreenShare = async (): Promise<MediaStream> => {
    if (!navigator.mediaDevices || !('getDisplayMedia' in navigator.mediaDevices)) {
      throw new Error('Screen sharing not supported')
    }

    try {
      console.log('Starting screen share...')
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true, // Include system audio if available
      })

      screenStream.value = stream
      isScreenSharing.value = true

      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          console.log('Screen share ended by user')
          stopScreenShare()
        })
      }

      return stream
    } catch (error) {
      console.error('Failed to start screen share:', error)
      mediaError.value = error instanceof Error ? error.message : 'Failed to start screen sharing'
      throw error
    }
  }

  const stopAudio = () => {
    const stream = localStream.value
    if (!stream) return

    stream.getAudioTracks().forEach((track) => track.stop())

    const videoTracks = stream.getVideoTracks()

    localStream.value = videoTracks.length > 0 ? new MediaStream(videoTracks) : null

    isAudioEnabled.value = false
    isAudioMuted.value = false
  }

  const stopVideo = () => {
    const stream = localStream.value
    if (!stream) return

    stream.getVideoTracks().forEach((track) => track.stop())

    const audioTracks = stream.getAudioTracks()
    localStream.value = audioTracks.length > 0 ? new MediaStream(audioTracks) : null

    if (localVideoRef.value) {
      localVideoRef.value.srcObject = null
    }

    isVideoEnabled.value = false
  }

  const stopScreenShare = () => {
    console.log('Stopping screen share stream...')
    screenStream.value?.getTracks().forEach((t) => t.stop())
    screenStream.value = null
    isScreenSharing.value = false
  }

  const stopAll = () => {
    const stream = localStream.value
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }

    localStream.value = null

    if (localVideoRef.value) {
      localVideoRef.value.srcObject = null
    }

    stopScreenShare()
    isVideoEnabled.value = false
    isAudioEnabled.value = false
    isAudioMuted.value = false
  }

  const toggleAudioTrack = (): void => {
    if (!localStream.value) return

    const audioTrack = localStream.value.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      isAudioEnabled.value = audioTrack.enabled
    }
  }

  const toggleVideoTrack = (): void => {
    if (!localStream.value) return

    const videoTrack = localStream.value.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      isVideoEnabled.value = videoTrack.enabled
    }
  }

  const getAudioTrack = () => localStream.value?.getAudioTracks()[0] ?? null

  const getVideoTrack = () => localStream.value?.getVideoTracks()[0] ?? null

  // TODO: Expose readonly Versions of the refs
  return {
    localStream,
    localVideoRef,
    screenStream,
    isVideoEnabled,
    isAudioEnabled,
    isAudioMuted,
    isScreenSharing,
    isGettingMedia,
    mediaError,
    startAudio,
    startVideo,
    startScreenShare,
    stopAudio,
    stopVideo,
    stopScreenShare,
    stopAll,
    toggleAudioTrack,
    toggleVideoTrack,
    getAudioTrack,
    getVideoTrack,
  }
}
