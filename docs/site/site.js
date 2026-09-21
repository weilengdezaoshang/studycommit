/* global window, document, getComputedStyle, requestAnimationFrame, IntersectionObserver */
;(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const animations = new Set()
  const easeOut = 'cubic-bezier(.2,.8,.2,1)'
  const token = (name, fallback) =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || fallback
  const fast = token('--duration-fast', 150)
  const normal = token('--duration-normal', 240)
  const slow = token('--duration-slow', 420)

  // All content is visible in CSS. Unsupported APIs and reduced motion keep that final state.
  function animate(element, frames, duration, delay = 0) {
    if (!element || reduced.matches || typeof element.animate !== 'function') {
      return
    }
    let animation
    try {
      animation = element.animate(frames, {
        duration,
        delay,
        easing: easeOut,
        fill: 'backwards',
      })
    } catch {
      return
    }
    animations.add(animation)
    animation.finished.catch(() => {}).finally(() => animations.delete(animation))
  }
  function cancelMotion() {
    if (reduced.matches) {
      animations.forEach((animation) => animation.cancel())
      animations.clear()
    }
  }
  reduced.addEventListener('change', cancelMotion)

  // Text is always readable. Only the decorative notes settle once.
  const notes = document.querySelectorAll('[data-hero-note]')
  if (window.scrollY < 80) {
    requestAnimationFrame(() => {
      const image = document.querySelector('.peeking-cat')
      // Do not delay content or replay a late illustration.
      if (image?.complete) {
        notes.forEach((note, index) =>
          animate(
            note,
            [
              { transform: 'translateY(12px)', opacity: 0 },
              { transform: 'translateY(0)', opacity: 1 },
            ],
            slow,
            index * 60,
          ),
        )
      }
      const underline = document.querySelector('.hero-underline')
      if (underline && !reduced.matches && typeof underline.animate === 'function') {
        try {
          const animation = underline.animate(
            [{ transform: 'scaleX(0) rotate(-1deg)' }, { transform: 'scaleX(1) rotate(-1deg)' }],
            { duration: slow, easing: easeOut, pseudoElement: '::after' },
          )
          animations.add(animation)
          animation.finished.catch(() => {}).finally(() => animations.delete(animation))
        } catch {
          // Unsupported pseudo-element animation leaves the CSS underline visible.
        }
      }
    })
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue
          }
          observer.unobserve(entry.target)
          if (entry.target.hasAttribute('data-flow')) {
            entry.target.querySelectorAll('[data-flow-paper]').forEach((paper, index) => {
              animate(
                paper,
                [
                  { opacity: 0, transform: 'translateY(8px)' },
                  { opacity: 1, transform: 'translateY(0)' },
                ],
                normal,
                index * 80,
              )
            })
            // Animate the stroke, keeping mobile arrow rotation intact.
            entry.target.querySelectorAll('.flow-arrow path').forEach((path, index) => {
              const length = path.getTotalLength()
              animate(
                path,
                [
                  { strokeDasharray: length, strokeDashoffset: length },
                  { strokeDasharray: length, strokeDashoffset: 0 },
                ],
                normal,
                normal + index * 80,
              )
            })
          } else {
            animate(
              entry.target,
              [
                { opacity: 0, transform: 'translateY(16px)' },
                { opacity: 1, transform: 'translateY(0)' },
              ],
              slow,
            )
          }
        }
      },
      { threshold: 0.15 },
    )
    document
      .querySelectorAll('[data-reveal], [data-flow]')
      .forEach((element) => observer.observe(element))
  }

  const menu = document.querySelector('.mobile-menu')
  menu?.querySelectorAll('a').forEach((link) =>
    link.addEventListener('click', () => {
      menu.open = false
      const hash = link.getAttribute('href')
      if (hash?.startsWith('#')) {
        const target = document.querySelector(hash)
        if (target) {
          target.setAttribute('tabindex', '-1')
          target.focus({ preventScroll: true })
        }
      }
    }),
  )
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu?.open) {
      menu.open = false
      menu.querySelector('summary').focus()
    }
  })
  document.addEventListener('click', (event) => {
    if (menu?.open && !menu.contains(event.target)) {
      menu.open = false
    }
  })

  const copy = document.getElementById('copy-code')
  const status = document.getElementById('copy-status')
  let resetTimer
  copy.hidden = false
  copy.addEventListener('click', async () => {
    clearTimeout(resetTimer)
    copy.disabled = true
    status.textContent = ''
    try {
      await navigator.clipboard.writeText('pnpm install\npnpm dev:desktop\npnpm dev:mobile')
      copy.textContent = '已复制'
      status.textContent = '启动命令已复制。桌面端与移动端可在不同终端分别启动。'
      animate(copy, [{ opacity: 0.65 }, { opacity: 1 }], fast)
    } catch {
      copy.textContent = '重试复制'
      status.textContent = '复制失败，请手动选择代码后复制。'
    } finally {
      copy.disabled = false
      resetTimer = setTimeout(() => {
        copy.textContent = '复制命令'
      }, 2000)
    }
  })
})()
