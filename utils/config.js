export default {
  SCRIPTS: { hack: '/utils/do-hack.js', grow: '/utils/do-grow.js', weaken: '/utils/do-weaken.js' },
  ROOTEDHOSTPATH: 'rootedHosts.txt',
  DECOMMISSION_FILE: 'decommission.txt',
  PURCHASE_BASE_MULTIPLER: 7,
  PURCHASE_BASELINE: inverseFormatMoney('1m'),
  USE_HOME: true,
  PORTCRACKER: (ns) => {
    return [
      { file: 'BruteSSH.exe', fun: ns.brutessh, has: false },
      { file: 'FTPCrack.exe', fun: ns.ftpcrack, has: false },
      { file: 'relaySMTP.exe', fun: ns.relaysmtp, has: false },
      { file: 'HTTPWorm.exe', fun: ns.httpworm, has: false },
      { file: 'SQLInject.exe', fun: ns.sqlinject, has: false },
    ]
  },
}

function inverseFormatMoney(money) {
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
