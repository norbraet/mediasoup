import env from '../config/env'
import type { Room, ClientService } from '../types'
import { Socket } from 'socket.io'

export const updateActiveSpeakers = async (
  room: Room,
  socket: Socket,
  clientService: ClientService
): Promise<Record<string, string[]>> => {
  const activeSpeakers = room.getRecentSpeakers(env.MAX_VISIBLE_ACTIVE_SPEAKER)
  const allSpeakers = room.getRecentSpeakers(100)
  const mutedSpeakers = allSpeakers.slice(env.MAX_VISIBLE_ACTIVE_SPEAKER)
  const newTransportsByPeer: Record<string, string[]> = {}

  for (const [, client] of room.clients) {
    for (const speakerSocketId of mutedSpeakers) {
      const speakerClient = clientService.getClientBySocketId(speakerSocketId)
      if (!speakerClient) continue

      if (client.socketId === speakerSocketId) {
        for (const [, producer] of client.producers) {
          if (!producer.paused) {
            await producer.pause()
          }
        }
        continue
      }

      for (const [, transportData] of client.consumerTransports) {
        const audioProducerId = transportData.associatedAudioProducerId
        const audioProducerClient = clientService.getClientByProducerId(audioProducerId)

        if (audioProducerClient?.socketId === speakerSocketId) {
          if (transportData.audio && !transportData.audio.paused) {
            await transportData.audio.pause()
          }
          if (transportData.video && !transportData.video.paused) {
            await transportData.video.pause()
          }
        }
      }
    }

    const newSpeakersToThisClient: string[] = []

    for (const speakerSocketId of activeSpeakers) {
      const speakerClient = clientService.getClientBySocketId(speakerSocketId)
      if (!speakerClient) continue

      if (client.socketId === speakerSocketId) {
        for (const [, producer] of client.producers) {
          if (producer.paused) {
            await producer.resume()
          }
        }
        continue
      }

      let hasConsumer = false
      for (const [, transportData] of client.consumerTransports) {
        const audioProducerId = transportData.associatedAudioProducerId
        const audioProducerClient = clientService.getClientByProducerId(audioProducerId)

        if (audioProducerClient?.socketId === speakerSocketId) {
          hasConsumer = true
          if (transportData.audio?.paused) {
            await transportData.audio.resume()
          }
          if (transportData.video?.paused) {
            await transportData.video.resume()
          }
          break
        }
      }

      if (!hasConsumer) {
        for (const [producerId, producer] of speakerClient.producers) {
          if (producer.kind === 'audio') {
            newSpeakersToThisClient.push(producerId)
            break
          }
        }
      }
    }

    if (newSpeakersToThisClient.length > 0) {
      newTransportsByPeer[client.socketId] = newSpeakersToThisClient
    }
  }

  // TODO: TYPES update-active-speakers
  socket.to(room.name).emit('update-active-speakers', activeSpeakers)

  return newTransportsByPeer
}
