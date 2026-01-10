import { types } from 'mediasoup'

export interface ProducerManager {
  addProducer(producer: types.Producer): void
  getCurrentProducer(): types.Producer | null
  removeProducer(producerId: string): void
  getAllProducers(): Map<string, types.Producer>
}

export function createProducerManager(): ProducerManager {
  const producers = new Map<string, types.Producer>()
  let currentProducer: types.Producer | null = null

  return {
    addProducer: (producer: types.Producer): void => {
      producers.set(producer.id, producer)
      currentProducer = producer // Simple last-producer-wins logic
    },

    getCurrentProducer: () => currentProducer,

    removeProducer: (producerId: types.Producer['id']): void => {
      producers.delete(producerId)
      if (currentProducer?.id === producerId) {
        currentProducer = null
      }
    },

    getAllProducers: () => new Map(producers),
  }
}
