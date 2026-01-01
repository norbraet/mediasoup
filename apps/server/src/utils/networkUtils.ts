import { networkInterfaces } from 'os'

function getAllExternalIPv4Addresses(): string[] {
  const nets = networkInterfaces()
  const results: string[] = []

  for (const name of Object.keys(nets)) {
    const net = nets[name]
    if (!net) continue

    for (const netInfo of net) {
      if (netInfo.family === 'IPv4' && !netInfo.internal) {
        results.push(netInfo.address)
      }
    }
  }

  return results
}

export function getLocalIP(): string {
  const ips = getAllExternalIPv4Addresses()

  const privateIP = ips.find(
    (ip) => ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')
  )

  return privateIP || ips[0] || 'localhost'
}

export function getAllNetworkIPs(): string[] {
  return ['localhost', '127.0.0.1', ...getAllExternalIPv4Addresses()]
}
