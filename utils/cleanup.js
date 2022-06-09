/** @param {NS} ns **/
export async function main(ns) {
  for (let file of ns.ls('home', '.js')) ns.rm(file)
}
