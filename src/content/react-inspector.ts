interface ReactComponentInfo {
  name: string
  filePath?: string
}

export function inspectReactComponent(element: Element): ReactComponentInfo | null {
  // Walk up DOM tree looking for React fiber
  let el: Element | null = element
  while (el) {
    const fiber = getReactFiber(el)
    if (fiber) {
      const component = findUserComponent(fiber)
      if (component) return component
    }
    el = el.parentElement
  }
  return null
}

function getReactFiber(element: Element): any | null {
  const keys = Object.keys(element)
  for (const key of keys) {
    if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
      return (element as any)[key]
    }
  }
  return null
}

function findUserComponent(fiber: any): ReactComponentInfo | null {
  let current = fiber
  const maxDepth = 50 // safety limit

  for (let i = 0; i < maxDepth && current; i++) {
    if (current.type && typeof current.type !== 'string') {
      // This is a user-defined component (not a built-in like 'div')
      const name = current.type.displayName || current.type.name
      if (name) {
        const info: ReactComponentInfo = { name }
        if (current._debugSource) {
          info.filePath = current._debugSource.fileName
        }
        return info
      }
    }
    current = current.return
  }
  return null
}

export function detectVue(element: Element): boolean {
  let el: Element | null = element
  while (el) {
    if ((el as any).__VUE__ || (el as any).__vue__) {
      return true
    }
    el = el.parentElement
  }
  return false
}
