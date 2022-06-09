/** @typedef { import("./types").NS } NS */

import config from './utils/config.js'
import { processSingleServerGrowth } from './utils/helper.js'

/**
 *
 * @export
 * @class Target
 */
export class Target {
  hostname
  maxRam
  ramUsed
  baseDifficulty
  hackDifficulty
  minDifficulty
  moneyAvailable
  moneyMax
  serverGrowth

  /**
   * Creates an instance of Target.
   * @param {NS} ns
   * @param {String} hostname
   * @memberof Target
   */
  constructor(ns, hostname) {
    this.ns = ns
    this.moneyThreshold = null
    this.securityThreshold = null
    this.round = {}

    this.init(hostname)
  }

  init(hostname) {
    const target = this.ns.getServer(hostname)
    Object.keys(target).forEach((key) => (this[key] = target[key]))

    this.moneyThreshold = this.moneyMax * 0.8
    this.securityThreshold = (this.baseDifficulty - this.minDifficulty) * 0.2 + this.minDifficulty
  }

  get hackPercent() {
    return this.ns.hackAnalyze(this.hostname)
  }
  get hackChance() {
    return this.ns.hackAnalyzeChance(this.hostname)
  }
  get hackSecurityGrow() {
    return this.ns.hackAnalyzeSecurity(1)
  }
  get hackTime() {
    return this.ns.getHackTime(this.hostname)
  }
  get weakenSecurityDecrease() {
    return this.ns.weakenAnalyze(1)
  }
  get weakenTime() {
    return this.ns.getWeakenTime(this.hostname)
  }
  get growPercent() {
    return this.ns.getServerGrowth(this.hostname)
  }
  get growSecurityGrow() {
    return this.ns.growthAnalyzeSecurity(1)
  }
  get growTime() {
    return this.ns.getGrowTime(this.hostname)
  }

  /**
   * 打印Target状态
   * @memberof Target
   */
  printState() {
    const ns = this.ns
    // 单个Thread一次hack能获得的金额百分比
    ns.print(`HackPercent: ${this.hackPercent * 100} %`)
    // hack成功率
    ns.print(`HackChance: ${this.hackChance * 100} %`)
    // hack导致的安全值上升
    ns.print(`HackSecurityGrow: ${this.hackSecurityGrow}`)
    // 当前Hack时间
    ns.print(`HackTime: ${this.hackTime / 1000} s`)
    // 单个Thread一次Weaken
    ns.print(`WeakenValue: ${this.weakenSecurityDecrease}`)
    // Weaken时间
    ns.print(`WeakenTime: ${this.weakenTime / 1000} s`)
    // 单个Thread一次grow
    ns.print(`GrowPercent: ${this.growPercent / 100} %`)
    // grow导致的安全值上升
    ns.print(`GrowSecurityGrow: ${this.growSecurityGrow}`)
    // grow时间
    ns.print(`GrowTime: ${this.growTime / 1000} s`)
  }

  /**
   * 获取执行时间列表
   * @return {number[]}
   * @memberof Target
   */
  getExecTimeList() {
    return [this.growTime, this.hackTime, this.weakenTime]
  }

  /**
   * 计算线程数量
   * @return {number[]}
   * @memberof Target
   */
  calHackThread() {
    const ns = this.ns
    let { moneyAvailable } = this

    const needWeaken = this.hackDifficulty > this.securityThreshold
    const needGrow = moneyAvailable < this.moneyThreshold

    // Grow
    let growThread = 0
    if (needGrow) {
      if (moneyAvailable <= 0) moneyAvailable = 1
      this.round.targetMoneyMult = this.moneyThreshold / moneyAvailable
      this.round.needGrow = needGrow
      growThread = Math.floor(ns.growthAnalyze(this.hostname, this.round.targetMoneyMult))
    }

    // Hack
    let hackThread = Math.ceil(1 / this.hackPercent)
    if (hackThread === Infinity) hackThread = 0

    // Weaken
    let weakenThread = 0
    if (needWeaken) {
      weakenThread += Math.floor((this.hackDifficulty - this.securityThreshold) / this.weakenSecurityDecrease)
    }

    return [hackThread, growThread, weakenThread]
  }

  /**
   *
   * @param {*} action
   * @param {*} needThreadNum
   * @param {*} serverList
   * @param {*} delayTime
   * @memberof Target
   */
  allocThreadHack(action, needThreadNum, serverList, delayTime, count) {
    if (action === 'grow') {
      this.hackDifficulty += this.ns.growthAnalyzeSecurity(needThreadNum)
      processSingleServerGrowth(this, needThreadNum, this.ns.getPlayer(), 1)
    }
    if (action === 'hack') {
      this.hackDifficulty += this.ns.hackAnalyzeSecurity(needThreadNum)
      let moneyDrained = Math.floor(this.moneyAvailable * this.hackPercent) * needThreadNum
      if (moneyDrained <= 0) moneyDrained = 0
      if (moneyDrained > this.moneyAvailable) moneyDrained = this.moneyAvailable
      this.moneyAvailable -= moneyDrained
    }
    if (action === 'weaken') {
      this.hackDifficulty = Math.max(this.minDifficulty, this.hackDifficulty - this.ns.weakenAnalyze(needThreadNum))
    }

    let i = 0
    while (needThreadNum > 0) {
      const { hostname, freeThreadNum } = serverList[i]
      const allocThreadNum = Math.min(freeThreadNum, needThreadNum)

      allocThreadNum > 0 &&
        this.ns.exec(config.SCRIPTS[action], hostname, allocThreadNum, this.hostname, delayTime, count)
      needThreadNum -= allocThreadNum
      serverList[i++].freeThreadNum -= allocThreadNum
    }
  }
}
