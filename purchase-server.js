/** @typedef { import("./types").NS } NS */

import { Queue } from './utils/helper'
import config from './utils/config'

const { PURCHASE_BASELINE, DECOMMISSION_FILE, PURCHASE_BASE_MULTIPLER } = config

/**
 * @export
 * @param {NS} ns
 */
export async function main(ns) {
  let killLogs = ['asleep', 'getServerMaxRam', 'getServerUsedRam', 'scp']
  killLogs.forEach((x) => ns.disableLog(x))

  if (!ns.fileExists(DECOMMISSION_FILE)) {
    await ns.write(DECOMMISSION_FILE)
  }

  let baseName = 'provisioned-'
  let inc = 1

  let { pendingDecomissions, multiplier, queue } = getPendingAndCurrent(ns)

  let nameCounter = 1
  let maxRam = Math.pow(2, 20)

  while (true) {
    let minMax = ns.getPurchasedServers().reduce(
      (a, e) => {
        a.min = Math.min(a.min, ns.getServerMaxRam(e))
        a.max = Math.max(a.max, ns.getServerMaxRam(e))
        return a
      },
      { min: maxRam + 1, max: Math.pow(2, multiplier) },
    )

    if (Math.pow(2, multiplier) >= maxRam && minMax.min >= maxRam) {
      ns.tprint('maxed on servers, killing process')
      return
    }

    let count = queue.length
    let money = ns.getPlayer().money
    let cash = money > PURCHASE_BASELINE ? money - PURCHASE_BASELINE : 0
    let ram = Math.min(Math.pow(2, 20), Math.pow(2, multiplier))
    let cost = ns.getPurchasedServerCost(ram)

    if (count >= ns.getPurchasedServerLimit() && cash >= cost) {
      let current = queue.peek()

      let nextRam = Math.min(Math.pow(2, 20), Math.pow(2, multiplier + inc))
      // All currently owned servers are at the same ram level. Bump the multiplier.
      if (
        (minMax.min === minMax.max || cash > Math.max(pendingDecomissions, 5) * ns.getPurchasedServerCost(nextRam)) &&
        multiplier != 20
      ) {
        ns.print('bumping ram multi from ' + multiplier + ' to ' + (multiplier + inc))
        multiplier = Math.min(20, multiplier + inc)
      }
      // Check if this is one of the servers in our queue that is under our current ram level
      else if (ns.getServerMaxRam(current) < Math.max(minMax.max, Math.pow(2, multiplier))) {
        // Server is still running something.
        if (ns.getServerUsedRam(current) != 0) {
          // Check that we aren't trying to decommission more servers than we can potentially buy
          if ((pendingDecomissions + 1) * cost < cash) {
            if (!ns.fileExists(DECOMMISSION_FILE, current)) {
              ns.print('marking ' + current + ' to be decommissioned')
              // Push out the marker file.
              await ns.scp(DECOMMISSION_FILE, 'home', current)
              pendingDecomissions++
            }
          }
        }
        // We have a low ram server that isn't running anything. Decommission it.
        else {
          // remove the peek'd item from the queue
          queue.dequeue()
          ns.killall(current)
          ns.deleteServer(current)
          pendingDecomissions--
          ns.print(ns.getPurchasedServers().map((item) => ({ name: item, ram: ns.getServerMaxRam(item) })))
        }
      }

      // If we didn't have anything to do with this server move it to the back of the line.
      if (current == queue.peek()) queue.enqueue(queue.dequeue())
    }
    // Check if we have the cash and capacity
    else if (count < ns.getPurchasedServerLimit() && cash >= cost) {
      let name = `${baseName}${nameCounter}-${ram}g`
      nameCounter++

      let newBox = ns.purchaseServer(name, ram)
      await ns.scp(Object.values(config.SCRIPTS), name)

      // New server added
      queue.enqueue(newBox)
    }

    await ns.asleep(100)
  }
}

/**
 * 获取服务器队列和当前的倍数
 * @param {NS} ns
 * @return {pending:Number, multiplier:Number, queue:Queue}
 */
function getPendingAndCurrent(ns) {
  let multi = PURCHASE_BASE_MULTIPLER
  let servers = ns.getPurchasedServers()
  if (servers.length > 0) {
    let maxRam = servers.reduce((a, e) => Math.max(a, ns.getServerMaxRam(e)), Math.pow(2, 3))
    while (Math.pow(2, multi) < maxRam) multi++
  }

  let queue = servers.reduce((a, e) => {
    a.enqueue(e)
    return a
  }, new Queue())
  let pendingDecomissions = servers.filter((s) => ns.fileExists(DECOMMISSION_FILE, s)).length

  return { pendingDecomissions: pendingDecomissions, multiplier: multi, queue: queue }
}
