import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CardDeck } from './PistaWorkshop'

afterEach(cleanup)

// jsdom has no native PointerEvent constructor; dispatch its real event name with the pointer fields.
function pointerEvent(element: Element, type: string, fields: Record<string, number | string | boolean> = {}) {
  fireEvent(element, Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
    pointerId: 1, pointerType: 'touch', isPrimary: true, ...fields,
  }))
}
function swipe(element: Element, fromX: number, fromY: number, toX: number, toY: number, pointerType = 'touch') {
  pointerEvent(element, 'pointerdown', { pointerType, clientX: fromX, clientY: fromY })
  pointerEvent(element, 'pointerup', { pointerType, clientX: toX, clientY: toY })
}

const cards = ['Primeira', 'Segunda', 'Terceira'].map(name => <div key={name}>{name}</div>)

describe('PistaWorkshop CardDeck pointer gestures', () => {
  it('moves left/right, keeps arrows and the page counter, and clamps both ends', () => {
    render(<CardDeck label="Pistas">{cards}</CardDeck>)
    const deck = screen.getByRole('group', { name: 'Pistas: cartas' })
    const pager = screen.getByRole('navigation', { name: 'Pistas' })
    expect(screen.getByText('Deslize para ver outras cartas')).toBeInTheDocument()
    expect(pager).toHaveTextContent('1 / 3')
    swipe(deck, 250, 100, 120, 110)
    expect(screen.getByText('Segunda')).toBeInTheDocument()
    expect(pager).toHaveTextContent('2 / 3')
    expect(screen.queryByText('Deslize para ver outras cartas')).not.toBeInTheDocument()
    swipe(deck, 250, 100, 120, 110)
    swipe(deck, 250, 100, 120, 110)
    expect(screen.getByText('Terceira')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pistas: próxima carta' })).toBeDisabled()
    swipe(deck, 100, 100, 240, 105)
    expect(screen.getByText('Segunda')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pistas: carta anterior' }))
    expect(screen.getByText('Primeira')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pistas: carta anterior' })).toBeDisabled()
    swipe(deck, 100, 100, 250, 105)
    expect(pager).toHaveTextContent('1 / 3')
  })

  it('ignores taps, short drags, vertical scroll gestures, mouse pointers and canceled gestures', () => {
    render(<CardDeck label="Revisão">{cards}</CardDeck>)
    const deck = screen.getByRole('group', { name: 'Revisão: cartas' })
    swipe(deck, 210, 100, 210, 100)
    swipe(deck, 210, 100, 175, 100)
    swipe(deck, 250, 100, 100, 290)
    swipe(deck, 250, 100, 100, 100, 'mouse')
    pointerEvent(deck, 'pointerdown', { clientX: 250, clientY: 100 })
    pointerEvent(deck, 'pointercancel')
    pointerEvent(deck, 'pointerup', { clientX: 90, clientY: 100 })
    expect(screen.getByText('Primeira')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Revisão' })).toHaveTextContent('1 / 3')
  })

  it('never swipes from interactive elements and keeps unsaved review drafts while paging', () => {
    const onCommand = vi.fn()
    function EditableDeck() {
      const [draft, setDraft] = useState('Original')
      return <CardDeck label="Revisão">{[
        <div key="draft">
          <input aria-label="Editar pista" value={draft} onChange={event => setDraft(event.target.value)} />
          <textarea aria-label="Observação" />
          <button type="button" onClick={onCommand}>Revisar pista</button>
        </div>,
        <div key="second">Outra pista</div>,
      ]}</CardDeck>
    }
    render(<EditableDeck />)
    const deck = screen.getByRole('group', { name: 'Revisão: cartas' })
    const input = screen.getByRole('textbox', { name: 'Editar pista' })
    fireEvent.change(input, { target: { value: 'Rascunho preservado' } })
    swipe(input, 240, 100, 90, 100)
    swipe(screen.getByRole('textbox', { name: 'Observação' }), 240, 100, 90, 100)
    swipe(screen.getByRole('button', { name: 'Revisar pista' }), 240, 100, 90, 100)
    expect(screen.getByRole('navigation', { name: 'Revisão' })).toHaveTextContent('1 / 2')
    expect(onCommand).not.toHaveBeenCalled()
    swipe(deck, 240, 100, 90, 100)
    expect(screen.getByText('Outra pista')).toBeInTheDocument()
    expect(onCommand).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Revisão: carta anterior' }))
    expect(screen.getByDisplayValue('Rascunho preservado')).toBeInTheDocument()
  })

  it('keeps page grouping and multiple independent decks intact', () => {
    render(<>
      <CardDeck label="Prêmios" pageSize={2}>{['A', 'B', 'C', 'D', 'E'].map(v => <div key={v}>Prêmio {v}</div>)}</CardDeck>
      <CardDeck label="Classificação" pageSize={3}>{['1', '2', '3', '4'].map(v => <div key={v}>Posição {v}</div>)}</CardDeck>
    </>)
    const awards = screen.getByRole('group', { name: 'Prêmios: cartas' })
    swipe(awards, 260, 40, 100, 40)
    expect(within(awards).getByText('Prêmio C')).toBeInTheDocument()
    expect(within(awards).getByText('Prêmio D')).toBeInTheDocument()
    expect(within(awards).queryByText('Prêmio E')).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Prêmios' })).toHaveTextContent('2 / 3')
    expect(screen.getByRole('navigation', { name: 'Classificação' })).toHaveTextContent('1 / 2')
  })
})
