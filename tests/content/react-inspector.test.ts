import { describe, it, expect } from 'vitest'
import { inspectReactComponent } from '../../src/content/react-inspector'

describe('inspectReactComponent', () => {
  it('returns null for elements without React fiber', () => {
    const el = document.createElement('div')
    expect(inspectReactComponent(el)).toBeNull()
  })

  it('detects React component name from fiber', () => {
    const el = document.createElement('div')
    const fiber = {
      type: { name: 'HeroSection', displayName: undefined },
      _debugSource: { fileName: 'src/Hero.tsx', lineNumber: 12 },
      return: null,
    }
    // Simulate React attaching fiber with random suffix
    ;(el as any).__reactFiber$abc123 = fiber

    const result = inspectReactComponent(el)
    expect(result).toBeTruthy()
    expect(result!.name).toBe('HeroSection')
    expect(result!.filePath).toBe('src/Hero.tsx')
  })

  it('prefers displayName over name', () => {
    const el = document.createElement('div')
    const fiber = {
      type: { name: 'X', displayName: 'MyDisplayName' },
      return: null,
    }
    ;(el as any).__reactFiber$xyz = fiber
    const result = inspectReactComponent(el)
    expect(result!.name).toBe('MyDisplayName')
  })

  it('walks up to find nearest user component', () => {
    const el = document.createElement('div')
    const parentFiber = {
      type: { name: 'AppLayout' },
      return: null,
    }
    const childFiber = {
      type: 'div', // built-in, not a component
      return: parentFiber,
    }
    ;(el as any).__reactFiber$xyz = childFiber
    const result = inspectReactComponent(el)
    expect(result!.name).toBe('AppLayout')
  })
})
