/** @typedef { import("../types").NS } NS */

/** @param {NS} ns **/
export async function main(ns) {
  edit(ns)
  // realityAlteration(ns)
}

// ========== Exploit: undocumented (Call the undocumented function)
function undocumented(ns) {
  ns.exploit()
}

// ========== Exploit: bypass (Circumventing the ram cost of document)
function bypass(ns) {
  eval('ns.bypass(document)')
}

// ========== Exploit: prototype tampering (Tamper with the Numbers prototype)
function prototypeTampering(ns) {
  ns.tprint((Number.prototype.toExponential = () => ''))
}

// Exploit: reality alteration (Alter reality)
function realityAlteration(ns) {
  // 开启debug模式，在sources中找到main.bundle.js
  // 搜索Reality has been altered!, 之后打断点->运行ns.alterReality()->修改变量
  ns.alterReality()
}

// ========== Exploit: edit (Open the dev menu)
function edit(ns) {
  const doc = eval('document')
  const boxes = Array.from(doc.querySelectorAll('.MuiBox-root'))
  const propKey = Object.keys(boxes[0]).find((key) => key.includes('Prop'))
  const getProps = (box) => box[propKey].children.props
  const props = getProps(
    boxes.find((box) => {
      const props = getProps(box)
      if (props) {
        return props.player
      } else {
        return false
      }
    }),
  )
  props.router.toDevMenu()
}

// ========== Exploit: unclickable (Click the unclickable)
function unclickable(ns) {
  const doc = eval('document')
  const unclickableBox = doc.querySelector('#unclickable')
  const propKey = Object.keys(unclickableBox).find((key) => key.includes('Prop'))
  const fakeElement = doc.createElement('div')
  fakeElement.style.display = 'none'
  fakeElement.style.visibility = 'hidden'
  unclickableBox.appendChild(fakeElement)
  unclickableBox[propKey].onClick({ target: fakeElement, isTrusted: true })
}
