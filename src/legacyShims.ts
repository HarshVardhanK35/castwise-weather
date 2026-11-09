// What an older TV browser (Chromium before 105 for container units, before 84
// for flex `gap`) needs from script. Each part first checks whether the browser
// already supports the feature and does nothing if it does.

// Container-query units (cqw, cqh, cqmin...): the CSS built by
// postcss-legacy-css.mjs reads --cq-w / --cq-h (1% of the container's width /
// height) and --cq-min / --cq-max, set here on every element marked
// `container-type`.
function installContainerUnits(): void {
  if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('width', '1cqw')) return

  let queued = false
  // Every container is watched for a change of its own size (a font loading, the frame
  // growing, a layout settling), not only for window resizes and new elements.
  const watcher = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => schedule()) : null
  const watched = new Set<Element>()

  // A container's own container units refer to the container ABOVE it, and only
  // its descendants refer to it. So the container's measure goes on its children
  // (the variables are inherited from there), never on the container itself.
  function measure(): void {
    queued = false
    document.querySelectorAll<HTMLElement>('*').forEach((el) => {
      if (getComputedStyle(el).getPropertyValue('--cq-box').trim() !== '1') return
      if (watcher && !watched.has(el)) {
        watched.add(el)
        watcher.observe(el)
      }
      const w = el.clientWidth / 100
      const h = el.clientHeight / 100
      Array.prototype.forEach.call(el.children, (child: HTMLElement) => {
        child.style.setProperty('--cq-w', `${w}px`)
        child.style.setProperty('--cq-h', `${h}px`)
        child.style.setProperty('--cq-min', `${Math.min(w, h)}px`)
        child.style.setProperty('--cq-max', `${Math.max(w, h)}px`)
      })
      const key = `${el.clientWidth}x${el.clientHeight}`
      if (el.dataset.cqLogged !== key) {
        el.dataset.cqLogged = key
        console.log('[legacy] container measured', el.className || el.tagName, key)
      }
    })
  }

  function schedule(): void {
    if (queued) return
    queued = true
    requestAnimationFrame(measure)
  }

  window.addEventListener('resize', schedule)
  window.addEventListener('load', schedule)
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true })
  // fonts arriving can change sizes without any resize or new element
  document.fonts?.ready.then(schedule)
  schedule()
}

// `gap` on a flex layout: where it is ignored, every flex gap becomes spacing on
// the children instead (a child with `margin: auto` is left alone).
function supportsFlexGap(): boolean {
  const box = document.createElement('div')
  box.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden'
  box.appendChild(document.createElement('div'))
  box.appendChild(document.createElement('div'))
  document.body.appendChild(box)
  const supported = box.scrollHeight === 1
  document.body.removeChild(box)
  return supported
}

function installFlexGapFallback(): void {
  if (supportsFlexGap()) return

  let queued = false

  function apply(): void {
    queued = false
    document.body.querySelectorAll<HTMLElement>('*').forEach((el) => {
      const style = getComputedStyle(el)
      if (style.display.indexOf('flex') === -1) return
      const column = style.flexDirection.indexOf('column') === 0
      const gap = parseFloat(column ? style.rowGap : style.columnGap) || 0
      const side = column ? 'marginTop' : 'marginLeft'
      Array.prototype.forEach.call(el.children, (child: HTMLElement, index: number) => {
        if (child.dataset.flexGapSkip) return
        if (child.dataset.flexGapBase === undefined) {
          if (child.style[side] === 'auto') {
            child.dataset.flexGapSkip = '1'
            return
          }
          child.dataset.flexGapBase = String(parseFloat(getComputedStyle(child)[side]) || 0)
        }
        const base = parseFloat(child.dataset.flexGapBase)
        child.style[side] = `${index === 0 ? base : base + gap}px`
      })
    })
  }

  function schedule(): void {
    if (queued) return
    queued = true
    requestAnimationFrame(apply)
  }

  window.addEventListener('resize', schedule)
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true })
  schedule()
}

export function installLegacyShims(): void {
  installContainerUnits()
  installFlexGapFallback()
}
