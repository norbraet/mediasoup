import { types, createWorker } from 'mediasoup'
import { mediasoupConfig as msc } from '../config/config'

export const createWorkers = async (): Promise<types.Worker[]> => {
  const workers: types.Worker[] = []

  for (let i = 0; i < msc.workersAmount; i++) {
    const worker = await createWorker({
      logLevel: msc.worker.logLevel,
      logTags: msc.worker.logTags,
      rtcMinPort: msc.worker.rtcMinPort,
      rtcMaxPort: msc.worker.rtcMaxPort,
    })

    worker.on('died', () => {
      console.error('Worker has died')
      process.exit(1)
    })

    workers.push(worker)
  }

  return workers
}
