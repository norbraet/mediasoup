import env from '../config/env'
import type { Room, ClientService } from '../types'
import { Socket } from 'socket.io'

export const updateActiveSpeakers = async (
  room: Room,
  socket: Socket,
  clientService: ClientService
): Promise<Record<string, string[]>> => {
  const activeSpeakers = room.getRecentSpeakers(env.MAX_VISIBLE_ACTIVE_SPEAKER)
  const allSpeakers = room.getRecentSpeakers(100) // All speakers
  const mutedSpeakers = allSpeakers.slice(env.MAX_VISIBLE_ACTIVE_SPEAKER)
  const newTransportsByPeer: Record<string, string[]> = {}

  for (const [, client] of room.clients) {
    // Mute speakers not in top 5
    for (const speakerSocketId of mutedSpeakers) {
      const speakerClient = clientService.getClientBySocketId(speakerSocketId)
      if (!speakerClient) continue

      // If this is the speaker themselves, pause their producers
      if (client.socketId === speakerSocketId) {
        for (const [, producer] of client.producers) {
          if (!producer.paused) {
            await producer.pause()
          }
        }
        continue
      }

      // Find and pause consumers for this muted speaker
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

    // Resume/create consumers for active speakers
    const newSpeakersToThisClient: string[] = []

    for (const speakerSocketId of activeSpeakers) {
      const speakerClient = clientService.getClientBySocketId(speakerSocketId)
      if (!speakerClient) continue

      // If this is the speaker themselves, resume their producers
      if (client.socketId === speakerSocketId) {
        for (const [, producer] of client.producers) {
          if (producer.paused) {
            await producer.resume()
          }
        }
        continue
      }

      // Check if client is already consuming this speaker
      let hasConsumer = false
      for (const [, transportData] of client.consumerTransports) {
        const audioProducerId = transportData.associatedAudioProducerId
        const audioProducerClient = clientService.getClientByProducerId(audioProducerId)

        if (audioProducerClient?.socketId === speakerSocketId) {
          hasConsumer = true
          // Resume existing consumers
          if (transportData.audio?.paused) {
            await transportData.audio.resume()
          }
          if (transportData.video?.paused) {
            await transportData.video.resume()
          }
          break
        }
      }

      // If no consumer exists, add to list for new transport creation
      if (!hasConsumer) {
        // Find the speaker's audio producer ID
        for (const [producerId, producer] of speakerClient.producers) {
          if (producer.kind === 'audio') {
            newSpeakersToThisClient.push(producerId)
            break
          }
        }
      }
    }

    // Store new speakers this client needs to consume
    if (newSpeakersToThisClient.length > 0) {
      newTransportsByPeer[client.socketId] = newSpeakersToThisClient
    }
  }

  // Broadcast updated active speakers to all clients in room
  socket.to(room.name).emit('update-active-speakers', activeSpeakers)

  return newTransportsByPeer
}
