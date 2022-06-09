/** @typedef { import("./types").NS } NS */

import { Target } from './target-class.js'
import { formatMoney, getAllServerNameList } from './utils/helper.js'

/**
 * @export
 * @param {NS} ns
 */
export async function main(ns) {
  const target = new Target(ns, ns.args[0])
  const delay = 100

  ns.disableLog('ALL')
  // 开始循环任务
  await hackEventLoop(ns, target, delay)
}

/**
 * Hack事件循环
 * @param {NS} ns
 * @param {Target} target
 * @param {number} delayInterval
 */
async function hackEventLoop(ns, target, delayInterval) {
  // 目标服务器当前情况
  const scriptRam = ns.getScriptRam('/utils/do-grow.js')
  let count = 0

  while (true) {
    const time = execHackEvent(ns, target, delayInterval, scriptRam, count++)
    ns.print(`当前间隔时间${time.toFixed(2)}ms`)
    await ns.sleep(time)
    // await ns.sleep(30)
  }
}

/**
 * 执行hack事件
 * @param {NS} ns
 * @param {Target} target
 * @param {number} delayInterval
 * @param {number} scriptRam
 * @param {number} count
 */
function execHackEvent(ns, target, delayInterval, scriptRam, count) {
  target.printState()

  const serverList = getAllServerNameList(ns).map((hostname) => ({
    hostname,
    freeThreadNum: Math.floor((ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname)) / scriptRam),
    maxThreadNum: Math.floor(ns.getServerMaxRam(hostname) / scriptRam),
  }))

  // 计算需要线程数和空闲进程数
  const totalNeedThread = target.calHackThread()
  printFirstCalLog(ns, totalNeedThread, target, count)

  const totalFreeThreadNum = serverList.reduce((acc, cur) => acc + cur.freeThreadNum, 0)

  // 根据ServerList 空闲进程数调整执行线程数
  const { isDecrease, execTotalNeedThread, execTotalNeedThreadNum } = adjustThread(
    ns,
    totalNeedThread,
    totalFreeThreadNum,
    count,
  )
  printFinalCalLog(ns, execTotalNeedThread, count)

  // 分配Job
  const execTimeList = genExecTimeList(execTotalNeedThread, target, delayInterval)
  const jobList = genJobList(execTotalNeedThread, execTimeList)
  const maxExecTime = execTimeList.reduce((a, b) => Math.max(a, b.execTime), 0)
  const minExecTime = execTimeList
    .filter((a) => a.execTime > 0)
    .reduce((a, b) => Math.min(a, b.execTime), Number.MAX_SAFE_INTEGER)

  printExecTimeLog(ns, target, execTimeList, maxExecTime, count)

  jobList.forEach(({ action, thread, delayTime }) => {
    ns.print(` 【${count}】执行${action}(${thread}) 延时(${(delayTime / 1000).toFixed(3)} s)`)
    target.allocThreadHack(action, thread, serverList, delayTime, count)
  })

  // 计算间隔时间
  return calInterval(ns, serverList, isDecrease, minExecTime, maxExecTime, execTotalNeedThreadNum, totalFreeThreadNum)
}

/**
 * 计算每轮间隔时间
 * @param {NS} ns
 * @param {{hostname: string, freeThreadNum: number, maxThreadNum: number}[]} serverList
 * @param {Boolean} isDecrease
 * @param {number} totalExecTime
 * @param {number} execTotalNeedThreadNum
 * @return {number}
 */
function calInterval(ns, serverList, isDecrease, minExecTime, maxExecTime, execTotalNeedThreadNum, totalFreeThreadNum) {
  const totalMaxThreadNum = serverList.reduce((prev, cur) => prev + cur.maxThreadNum, 0)
  const maxParallelNum = isDecrease ? 1 : totalMaxThreadNum / execTotalNeedThreadNum
  let interval = (isDecrease ? maxExecTime : minExecTime) / maxParallelNum
  interval = interval > 0 ? interval : 1000
  // interval = Math.max(1000, interval)
  ns.print(
    `总线程数量: ${totalMaxThreadNum}, 空闲线程: ${totalFreeThreadNum}
一轮需要线程: ${execTotalNeedThreadNum}, 最大并行数: ${maxParallelNum.toFixed(2)}`,
  )
  return Math.max(30, interval)
}

/**
 * 根据ServerList 总Ram调整线程数
 * @param {NS} ns
 * @param {Array} serverList
 * @param {number[]} totalNeedThread
 * @param {number} count
 * @return {{execTotalNeedThread: number[], execTotalNeedThreadNum: number}}
 */
function adjustThread(ns, totalNeedThread, totalFreeThreadNum, count) {
  // 补偿weaken线程
  const [hackThread, growThread] = totalNeedThread
  let totalNeedThreadNum = totalNeedThread.reduce((acc, cur) => acc + cur, 0)
  const isDecrease = totalNeedThreadNum > totalFreeThreadNum

  // 削减线程数, 按数组[hack, grow, weaken]顺序为优先级削减
  if (isDecrease) {
    ns.print(`【${count}】Thread超额，需要(${totalNeedThreadNum}t)，空闲(${totalFreeThreadNum}t)，开始削减`)

    let threadGap = totalNeedThreadNum - totalFreeThreadNum
    totalNeedThread = totalNeedThread.map((thread) => {
      const isGreaterThan = threadGap > thread
      const res = isGreaterThan ? 0 : thread - threadGap
      threadGap = isGreaterThan ? threadGap - thread : 0
      return res
    })
  } else {
    const freeThreadNum = totalFreeThreadNum - totalNeedThreadNum
    let weakenIncreaseThread = Math.ceil((hackThread * 0.002) / 0.05) + Math.ceil((growThread * 0.004) / 0.05)
    weakenIncreaseThread = freeThreadNum > weakenIncreaseThread ? weakenIncreaseThread : freeThreadNum
    totalNeedThread[2] += weakenIncreaseThread
  }

  totalNeedThread.splice(0, 0, totalNeedThread.splice(1, 1)[0]) // 调整为执行顺序 [grow, hack, weaken]
  totalNeedThreadNum = totalNeedThread.reduce((acc, cur) => acc + cur, 0)

  return {
    isDecrease,
    execTotalNeedThread: totalNeedThread,
    execTotalNeedThreadNum: totalNeedThreadNum,
  }
}

/**
 * 根据totalNeedThread里的Job顺序生成执行时间
 * @param {number[]} totalNeedThread
 * @param {Target} target
 * @param {number} [delayInterval=200]
 * @return {[{execTime: number, delayTime: number}]}
 */
function genExecTimeList(totalNeedThread, target, delayInterval = 200) {
  const timeList = target.getExecTimeList().map((time, i) => (totalNeedThread[i] > 0 ? time : 0))
  let prevTime = 0
  return timeList.map((execTime) => {
    let delayTime = 0
    if (execTime > 0 && execTime < prevTime) {
      delayTime = prevTime - execTime + delayInterval
      execTime += delayTime
    }
    prevTime = execTime
    return {
      execTime,
      delayTime,
    }
  })
}

/**
 * 根据totalNeedThread和execTimeList生成Job列表
 * @param {number[]} totalNeedThread
 * @param {[{execTime: number, delayTime: number}]} execTimeList
 * @return {[{action: string, thread: number, execTime: number, delayTime: number]}
 */
function genJobList(totalNeedThread, execTimeList) {
  const actions = ['grow', 'hack', 'weaken']
  return actions.map((action, i) => ({
    action,
    thread: totalNeedThread[i],
    ...execTimeList[i],
  }))
}

function printFirstCalLog(ns, totalNeedThread, target, count) {
  const [hackThread, growThread, weakenThread] = totalNeedThread
  const {
    hackDifficulty: security,
    moneyAvailable: money,
    round: { needGrow, targetMoneyMult },
    securityThreshold,
    moneyThreshold,
  } = target
  if (needGrow) {
    ns.print(`【${count}】目标金额增长比例(${targetMoneyMult.toFixed(3)})`)
  }
  ns.print(`【${count}】Hack金额目标(${formatMoney(needGrow ? moneyThreshold : money)})`)
  ns.print(
    `【${count}】
        初步计算
        Weaken(t=${weakenThread}), 安全(${security.toFixed(2)}), 阈值(${securityThreshold.toFixed(2)})
        Grow(t=${growThread}), 当前(${formatMoney(money)}), 阈值(${formatMoney(moneyThreshold)}),
        Hack(t=${hackThread})`,
  )
}

function printFinalCalLog(ns, execTotalNeedThread, count) {
  const [growThread, hackThread, weakenThread] = execTotalNeedThread
  ns.print(`【${count}】最终计算, Weaken(t=${weakenThread}), Grow(t=${growThread}), Hack(t=${hackThread})`)
}

function printExecTimeLog(ns, target, execTimeList, totalTime, count) {
  const [adjustedGrowTime, adjustedHackTime, adjustWeakenTime] = execTimeList.map((item) => item.execTime)
  ns.print(
    ` 【${count}】
      Hack用时(${(target.hackTime / 1000).toFixed(3)} s), Adjusted(${(adjustedHackTime / 1000).toFixed(3)} s)
      Grow用时(${(target.growTime / 1000).toFixed(3)} s), Adjusted(${(adjustedGrowTime / 1000).toFixed(3)} s) 
      Weaken用时(${(target.weakenTime / 1000).toFixed(3)} s), Adjusted(${(adjustWeakenTime / 1000).toFixed(3)} s)`,
  )

  ns.print(`【${count}】开始执行脚本，预计需要${(totalTime / 1000).toFixed(3)} s`)
}
