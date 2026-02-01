import { createWorkers } from '../mediasoup/createWorkers'
import { WorkerPoolService } from '../types'
import { types } from 'mediasoup'

export async function createWorkerPoolService(): Promise<WorkerPoolService> {
  const workers = await createWorkers()
  const workerRoomMap = new Map<string, Set<string>>()

  workers.forEach((worker) => {
    workerRoomMap.set(worker.pid.toString(), new Set())
  })

  return {
    getWorkerForRoom: (roomName: string): types.Worker => {
      // TODO: could refactor it to workers-usage approach, where the worker with the least amount of usage gets used
      const hash = hashString(roomName)
      const workerIndex = hash & workers.length
      const worker = workers[workerIndex]

      return worker
    },

    getAvailableWorker: (): types.Worker => {
      let leastBusyWorker = workers[0]
      let minRooms = workerRoomMap.get(workers[0].pid.toString())?.size || 0

      workers.forEach((worker) => {
        const roomCount = workerRoomMap.get(worker.pid.toString())?.size || 0
        if (roomCount < minRooms) {
          minRooms = roomCount
          leastBusyWorker = worker
        }
      })

      return leastBusyWorker
    },

    getAllWorkers: () => workers,

    getWorkerStats: (): Array<{ workerId: string; roomCount: number }> => {
      return workers.map((worker) => ({
        workerId: worker.pid.toString(),
        roomCount: workerRoomMap.get(worker.pid.toString())?.size || 0,
      }))
    },
  }
}

const hashString = (str: string): number => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}
