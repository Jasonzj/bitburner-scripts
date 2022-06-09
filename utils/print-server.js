/** @typedef { import("../types").NS } NS */

/** @param {NS} ns **/
export async function main(ns) {
  const name = ns.args[0]
  await ns.tprint({
    ...ns.getServer(name),
    hackPercent: ns.hackAnalyze(name),
    hackChance: ns.hackAnalyzeChance(name),
    hackTime: ns.getHackTime(name),
    weakenTime: ns.getWeakenTime(name),
    growPercent: ns.getServerGrowth(name),
    growTime: ns.getGrowTime(name),
  })
}
