import { createWorkers } from './createWorkers'
import { mediasoupConfig as msc } from '../config/config'
import { types } from 'mediasoup'

export const initMediasoup = async (): Promise<types.Router> => {
  const workers = await createWorkers()
  return await workers[0].createRouter({
    mediaCodecs: msc.router.mediaCodecs,
  })
}
