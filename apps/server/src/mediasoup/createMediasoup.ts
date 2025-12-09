import { createWorkers } from './createWorkers'

export const initMediasoup = async (): Promise<void> => {
  await createWorkers()
}
