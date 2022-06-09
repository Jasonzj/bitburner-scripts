/** @typedef { import("./types").NS } NS */

import config from './utils/config'
let portCracker

/**
 * 扫描服务器
 * @param {NS} ns
 * @param {string} [root='home']
 * @return {Promise<Server[]>}
 */
async function scan(ns, root = 'home') {
  const q = [root]
  const res = []

  while (q.length) {
    let qSize = q.length

    while (qSize--) {
      const cur = q.shift()
      res.push(cur)

      const children = ns.scan(cur)

      if (cur !== 'home') children.shift()

      children.forEach((child) => q.push(child))
    }
  }

  return res.map((host) => ns.getServer(host))
}

/**
 * 获取可root的服务器列表
 * @param {NS} ns
 * @return {Promise<Server[]>}
 */
async function getCrackableList(ns) {
  const serverLists = await scan(ns)
  const hackingSkill = await ns.getHackingLevel()
  let openPortAbility = 0

  portCracker.forEach(({ file }, i, arr) => {
    if (ns.fileExists(file, 'home')) {
      openPortAbility += 1
      arr[i].has = true
    }
  })

  return serverLists.filter(
    ({ hostname, numOpenPortsRequired, requiredHackingSkill }) =>
      numOpenPortsRequired <= openPortAbility &&
      requiredHackingSkill <= hackingSkill &&
      hostname !== 'home' &&
      !hostname.includes('provisioned'),
  )
}

/**
 * @export
 * @param {NS} ns
 */
export async function main(ns) {
  while (true) {
    portCracker = config.PORTCRACKER(ns)

    const serverLists = await getCrackableList(ns)

    for (const server of serverLists) {
      const { hostname } = server

      if (!ns.hasRootAccess(hostname)) {
        portCracker.forEach(({ fun, has }) => has && fun(hostname))
        ns.nuke(hostname)
      }
    }

    const rootedHosts = serverLists.map(({ hostname }) => hostname)
    for (const hostname of rootedHosts) await ns.scp(Object.values(config.SCRIPTS), hostname)
    await ns.write('rootedHosts.txt', rootedHosts.join('\n'), 'w')

    await ns.sleep(1000 * 60 * 1)
  }
}
