import { render, screen } from '@testing-library/react'
import { Capacitor } from '@capacitor/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PistaWorkshop } from './PistaWorkshop'

afterEach(() => vi.restoreAllMocks())

describe('Pista Única workshop native safe-area', () => {
  it('adds Android status-bar clearance when the native WebView overlays the status bar', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    const { container } = render(<PistaWorkshop mode="1 celular"><p>Tela do jogo</p></PistaWorkshop>)
    expect(screen.getByText('Tela do jogo')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('pista-workshop--android')
  })

  it('keeps browser and iOS safe areas unchanged', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web')
    const { container } = render(<PistaWorkshop mode="1 celular">Web</PistaWorkshop>)
    expect(container.firstElementChild).not.toHaveClass('pista-workshop--android')
  })
})
