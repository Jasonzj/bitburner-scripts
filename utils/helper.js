/** @typedef { import("../types").NS } NS */

import config from './utils/config.js'

/**
 * 获取所有服务器列表
 * @export
 * @param {NS} ns
 * @return {string[]}
 */
export function getAllServerNameList(ns) {
  return ns
    .read(config.ROOTEDHOSTPATH)
    .split('\n')
    .concat(ns.getPurchasedServers())
    .concat(config.USE_HOME ? 'home' : [])
}

/**
 * 获取已root服务器列表
 * @export
 * @param {NS} ns
 * @return {string[]}
 */
export function getRoodedServerNameList(ns) {
  return ns.read(config.ROOTEDHOSTPATH).split('\n')
}

/**
 * 格式化金额
 * @export
 * @param {Number} money
 * @return {String}
 */
export function formatMoney(money) {
  if (money >= 1e12) {
    return `${(money / 1e12).toFixed(2)} t`
  } else if (money >= 1e9) {
    return `${(money / 1e9).toFixed(2)} b`
  } else if (money >= 1e6) {
    return `${(money / 1e6).toFixed(2)} m`
  } else if (money >= 1000) {
    return `${(money / 1000).toFixed(2)} k`
  } else {
    return `${+money.toFixed(2)}`
  }
}

/**
 * 反格式化金额
 * @export
 * @param {String} money
 * @return {Number}
 */
export function inverseFormatMoney(money) {
  const sign = money.charAt(money.length - 1)
  switch (sign) {
    case 't':
      return Number.parseFloat(money) * 1e12
    case 'b':
      return Number.parseFloat(money) * 1e9
    case 'm':
      return Number.parseFloat(money) * 1e6
    case 'k':
      return Number.parseFloat(money) * 1000
    default:
      return Number.parseFloat(money)
  }
}

/**
 * 为flag适配exec, run传参
 * @param {NS} ns
 * @param {Object} argsSchema
 * @return {Object}
 */
function flags(ns, argsSchema) {
  const params = ns.flags(argsSchema)
  if (params.length) {
    const option = JSON.parse(params['_'][0])
    for (const [key, value] of Object.entries(option)) {
      params[key] = value
    }
  }

  return params
}

/**
 * Queue
 * @export
 * @class Queue
 * @extends {Array}
 */
export class Queue extends Array {
  /**
   * Adds a new item to the queue.
   * @param {Any} val
   */
  enqueue(val) {
    this.push(val)
  }

  /**
   * Removes an item from the queue.
   * @returns {Any}
   */
  dequeue() {
    return this.shift()
  }

  /**
   * Returns the next item in the queue without removing it.
   * @returns {Any}
   */
  peek() {
    return this[0]
  }

  /**
   * @returns {Number}
   */
  isEmpty() {
    return this.length === 0
  }
}

export function calculateServerGrowth(server, threads, p, cores = 1) {
  const numServerGrowthCycles = Math.max(Math.floor(threads), 0)

  //Get adjusted growth rate, which accounts for server security
  const growthRate = 1.03
  let adjGrowthRate = 1 + (growthRate - 1) / server.hackDifficulty
  if (adjGrowthRate > 1.0035) {
    adjGrowthRate = 1.0035
  }

  //Calculate adjusted server growth rate based on parameters
  const serverGrowthPercentage = server.serverGrowth / 100
  const numServerGrowthCyclesAdjusted = numServerGrowthCycles * serverGrowthPercentage * 1

  //Apply serverGrowth for the calculated number of growth cycles
  const coreBonus = 1 + (cores - 1) / 16
  return Math.pow(adjGrowthRate, numServerGrowthCyclesAdjusted * p.hacking_grow_mult * coreBonus)
}

export function numCycleForGrowth(server, growth, p, cores = 1) {
  let ajdGrowthRate = 1 + (1.03 - 1) / server.hackDifficulty
  if (ajdGrowthRate > 1.0035) {
    ajdGrowthRate = 1.0035
  }

  const serverGrowthPercentage = server.serverGrowth / 100

  const coreBonus = 1 + (cores - 1) / 16
  const cycles =
    Math.log(growth) / (Math.log(ajdGrowthRate) * p.hacking_grow_mult * serverGrowthPercentage * 1 * coreBonus)

  return cycles
}

//Applied server growth for a single server. Returns the percentage growth
export function processSingleServerGrowth(server, threads, p, cores = 1) {
  let serverGrowth = calculateServerGrowth(server, threads, p, cores)
  if (serverGrowth < 1) {
    console.warn('serverGrowth calculated to be less than 1')
    serverGrowth = 1
  }

  const oldMoneyAvailable = server.moneyAvailable
  server.moneyAvailable += 1 * threads // It can be grown even if it has no money
  server.moneyAvailable *= serverGrowth

  // in case of data corruption
  if (isValidNumber(server.moneyMax) && isNaN(server.moneyAvailable)) {
    server.moneyAvailable = server.moneyMax
  }

  // cap at max
  if (isValidNumber(server.moneyMax) && server.moneyAvailable > server.moneyMax) {
    server.moneyAvailable = server.moneyMax
  }

  // if there was any growth at all, increase security
  if (oldMoneyAvailable !== server.moneyAvailable) {
    //Growing increases server security twice as much as hacking
    let usedCycles = numCycleForGrowth(server, server.moneyAvailable / oldMoneyAvailable, p, cores)
    usedCycles = Math.min(Math.max(0, Math.ceil(usedCycles)), threads)
  }
  return server.moneyAvailable / oldMoneyAvailable
}

export function isValidNumber(n) {
  return typeof n === 'number' && !isNaN(n)
}

/** Format a duration (in milliseconds) as e.g. '1h 21m 6s' for big durations or e.g '12.5s' / '23ms' for small durations */
export function formatDuration(duration) {
  if (duration < 1000) return `${duration.toFixed(0)}ms`
  const portions = []
  const msInHour = 1000 * 60 * 60
  const hours = Math.trunc(duration / msInHour)
  if (hours > 0) {
    portions.push(hours + 'h')
    duration -= hours * msInHour
  }
  const msInMinute = 1000 * 60
  const minutes = Math.trunc(duration / msInMinute)
  if (minutes > 0) {
    portions.push(minutes + 'm')
    duration -= minutes * msInMinute
  }
  let seconds = duration / 1000.0
  // Include millisecond precision if we're on the order of seconds
  seconds = hours == 0 && minutes == 0 ? seconds.toPrecision(3) : seconds.toFixed(0)
  if (seconds > 0) {
    portions.push(seconds + 's')
    duration -= minutes * 1000
  }
  return portions.join(' ')
}
