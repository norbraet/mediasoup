import { Socket } from 'socket.io'
import type { Room, ClientService, RecentSpeakerData, ActiveSpeakerManager } from '../types'
import { updateActiveSpeakers } from './activeSpeakerService'
import env from '../config/env'

export function createActiveSpeakerManager(
  clientService: ClientService,
  socket: Socket
): ActiveSpeakerManager {
  // 🔥 Setup event handling for a specific room
  function setupActiveSpeakerHandling(room: Room): void {
    room.activeSpeakerObserver.on('dominantspeaker', async (dominantSpeaker) => {
      // Find the client who owns this producer
      const client = Array.from(room.clients.values()).find((client) =>
        Array.from(client.producers.values()).some(
          (producer) => producer.id === dominantSpeaker.producer.id
        )
      )

      if (client) {
        // Update the room's speaker list
        room.updateActiveSpeakerList(client.socketId)

        try {
          const newTransportsByPeer = await updateActiveSpeakers(room, socket, clientService)

          for (const [socketId, audioProducerIds] of Object.entries(newTransportsByPeer)) {
            const speakerData: RecentSpeakerData[] = []

            for (const audioProducerId of audioProducerIds) {
              const producerClient = clientService.getClientByProducerId(audioProducerId)
              if (!producerClient) continue

              let videoProducerId: string | null = null
              for (const [producerId, producer] of producerClient.producers) {
                if (producer.kind === 'video') {
                  videoProducerId = producerId
                  break
                }
              }

              speakerData.push({
                audioProducerId,
                videoProducerId,
                userName: producerClient.userName,
                userId: producerClient.socketId,
              })
            }

            socket.to(socketId).emit('new-producer-to-consume', {
              routerRtpCapabilities: room.router.rtpCapabilities,
              recentSpeakersData: speakerData,
              activeSpeakerList: room.getRecentSpeakers(env.MAX_VISIBLE_ACTIVE_SPEAKER),
            })
          }
        } catch (error) {
          console.error('Error updating active speakers on dominant speaker change:', error)
        }
      }
    })
  }

  return {
    setupActiveSpeakerHandling,
  }
}
