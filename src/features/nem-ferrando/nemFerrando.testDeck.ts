import type { NemFerrandoDeck } from './content/nemFerrandoContent.types'

export const nemFerrandoTestDeck: NemFerrandoDeck = {
  schemaVersion: 2,
  gameId: 'nem-ferrando',
  deckId: 'nem-ferrando-test-deck',
  locale: 'pt-BR',
  version: 1,
  title: 'Baralho de teste',
  cards: [
    {
      id: 'espaco',
      number: 1,
      theme: 'Espaço',
      irons: 4,
      curiosities: [
        { id: 'espaco-lua-distancia', question: 'Distância média entre a Terra e a Lua', answer: 384400, unit: 'km' },
        { id: 'espaco-luz-sol', question: 'Luz do sol até a Terra', answer: 8, unit: 'minutos' },
        { id: 'espaco-luas-conhecidas', question: 'Luas conhecidas de Júpiter', answer: 95 },
      ],
    },
    {
      id: 'sistema-solar',
      number: 2,
      theme: 'Sistema Solar',
      irons: 5,
      curiosities: [
        { id: 'sistema-solar-planetas', question: 'Quantidade de planetas no Sistema Solar', answer: 8 },
        { id: 'sistema-solar-jupiter-diametro', question: 'Diâmetro aproximado de Júpiter', answer: 139820, unit: 'km' },
        { id: 'sistema-solar-saturno-aneis', question: 'Largura aproximada dos anéis de Saturno', answer: 282000, unit: 'km' },
      ],
    },
    {
      id: 'terra',
      number: 3,
      theme: 'Terra',
      irons: 4,
      curiosities: [
        { id: 'terra-circunferencia', question: 'Circunferência aproximada da Terra', answer: 40075, unit: 'km' },
        { id: 'terra-altitude-everest', question: 'Altitude do Everest', answer: 8849, unit: 'm' },
        { id: 'terra-agua-superficie', question: 'Percentual da superfície coberta por água', answer: 71, unit: '%' },
      ],
    },
    {
      id: 'brasil',
      number: 4,
      theme: 'Brasil',
      irons: 3,
      curiosities: [
        { id: 'brasil-area', question: 'Área aproximada do Brasil', answer: 8510000, unit: 'km²' },
        { id: 'brasil-estados', question: 'Quantidade de estados brasileiros', answer: 26 },
        { id: 'brasil-litoral', question: 'Distância aproximada do litoral brasileiro', answer: 7491, unit: 'km' },
      ],
    },
  ],
}
