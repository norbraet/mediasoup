import { createWorkers } from './createWorkers'
import { mediasoupConfig as msc } from '../config/config'

export const initMediasoup = async (): Promise<void> => {
  const workers = await createWorkers()
  await workers[0].createRouter({
    mediaCodecs: msc.router.mediaCodecs,
  })
}
