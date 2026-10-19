import { useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, Club, Heart, Menu, MessageCircle, Plus, Settings2, Smartphone, Sparkles, Spade, Users, WifiOff, X } from 'lucide-react'
import { gamesRegistry } from '../games/games.registry'
import type { GameModule } from '../games/games.types'
import { storeLinks, type StorePlatform } from './landing.config'
import './landing.css'

const catalog = gamesRegistry.filter((game) => game.status === 'available' && game.coverImage)
const orderedIds = ['impostor-da-palavra', 'nem-ferrando', 'mimica', 'pista-unica', 'top-10', 'ultima-pista', 'quem-sou-eu', 'adedonha', 'taboo', 'cidade-dorme']
const games = [...catalog].sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id))
const filters = [
  { label: 'Todos os jogos', tags: [] },
  { label: 'Dedução & mistério', tags: ['dedução', 'enigmas'] },
  { label: 'Palavras & palpites', tags: ['palavras', 'cartas', 'ranking'] },
  { label: 'Em equipes', tags: ['equipes', 'times'] },
]
const categoryLabels: Record<string, string> = {
  'impostor-da-palavra': 'Confie desconfiando', 'nem-ferrando': 'Vale o seu palpite', mimica: 'Seu talento é o limite',
  'pista-unica': 'Pense fora do óbvio', 'top-10': 'Acerte o ranking', 'ultima-pista': 'Desvende o mistério',
  'quem-sou-eu': 'A resposta está na sua testa', adedonha: 'O clássico da galera', taboo: 'Cuidado com a palavra', 'cidade-dorme': 'Ninguém é inocente',
}

function publicAsset(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}

function Brand() {
  return <a className="gl-brand" href="#inicio" aria-label="Galerows, início">
    <img className="gl-brand-lockup" src={publicAsset('/assets/brand/galerows-logo.svg')} width="196" height="49" alt="" />
  </a>
}

function StoreIcon({ platform }: { platform: StorePlatform }) {
  return platform === 'apple'
    ? <svg width="27" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 12.54c.03 3.15 2.76 4.2 2.79 4.21-.02.07-.44 1.5-1.44 2.98-.87 1.28-1.78 2.55-3.2 2.58-1.39.03-1.84-.83-3.43-.83-1.6 0-2.1.8-3.42.86-1.37.05-2.41-1.38-3.29-2.65C3.26 17.1 1.9 12.37 3.74 9.18c.91-1.58 2.53-2.58 4.29-2.61 1.34-.03 2.6.91 3.42.91.82 0 2.36-1.12 3.98-.96.68.03 2.59.27 3.82 2.07-.1.06-2.28 1.33-2.2 3.95ZM14.45 4.8c.73-.89 1.23-2.12 1.09-3.35-1.06.04-2.35.71-3.11 1.59-.68.78-1.29 2.04-1.13 3.24 1.18.09 2.39-.6 3.15-1.48Z" /></svg>
    : <svg width="27" height="30" viewBox="0 0 24 26" aria-hidden="true"><path fill="#62d6e9" d="M2 1.4 14.1 13 2 24.6Z" /><path fill="#83e6a0" d="m2 1.4 15.7 8.8-3.6 2.8Z" /><path fill="#ffce68" d="m17.7 10.2 4.1 2.3q.8.5 0 1l-4.1 2.3-3.6-2.8Z" /><path fill="#ff828b" d="m2 24.6 12.1-11.6 3.6 2.8Z" /></svg>
}

function StoreButton({ platform }: { platform: StorePlatform }) {
  const url = storeLinks[platform]
  const name = platform === 'apple' ? 'App Store' : 'Google Play'
  const contents = <><StoreIcon platform={platform} /><span><small>{url ? 'Baixe na' : 'EM BREVE NA'}</small><strong>{name}</strong></span>{url ? <ArrowUpRight size={16} aria-hidden="true" /> : <span className="gl-store-dot" aria-hidden="true" />}</>
  return url
    ? <a className="gl-store-button" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Baixar Galerows na ${name}`}>{contents}</a>
    : <button className="gl-store-button" type="button" disabled aria-label={`${name}: download em breve`}>{contents}</button>
}

function StoreButtons() {
  return <div className="gl-store-buttons"><StoreButton platform="apple" /><StoreButton platform="google" /></div>
}

function GameArtwork({ game, className = '' }: { game: GameModule; className?: string }) {
  return <img className={className} src={publicAsset(game.coverImage!)} alt="" loading="lazy" width="640" height="360" />
}

function HeroStage() {
  return <div className="gl-stage" role="img" aria-label="Prévia ilustrativa do Galerows no celular, cercado por cartas dos jogos Mímica e Impostor da Palavra">
    <div className="gl-orbit gl-orbit-one" /><div className="gl-orbit gl-orbit-two" />
    <Plus className="gl-stage-plus" size={28} aria-hidden="true" />
    <Spade className="gl-stage-spade" size={36} aria-hidden="true" />
    <div className="gl-fan-card gl-fan-left"><img src={publicAsset('/assets/games/mimica.webp')} alt="" width="340" height="460" /><span>FAÇA A CENA.<strong>MÍMICA</strong><small>SEM DIZER UMA PALAVRA.</small></span><Club size={25} aria-hidden="true" /></div>
    <div className="gl-fan-card gl-fan-right"><img src={publicAsset('/assets/games/impostor-palavra.jpg')} alt="" width="340" height="460" /><span>QUEM ESTÁ BLEFANDO?<strong>IMPOSTOR<br />DA PALAVRA</strong></span><Spade size={24} aria-hidden="true" /></div>
    <div className="gl-phone">
      <div className="gl-phone-top"><span>9:41</span><span className="gl-phone-camera" /><span>▮▮▮ ▰</span></div>
      <div className="gl-phone-header"><img src={publicAsset('/assets/brand/galerows-mark.svg')} width="34" height="34" alt="" /><span>galerows.</span><Settings2 size={17} aria-hidden="true" /></div>
      <div className="gl-phone-greeting"><small>A GALERA CHEGOU.</small><strong>Qual vai ser<br />o jogo da vez?</strong><span>Escolha um jogo e reúna a turma.</span></div>
      <div className="gl-phone-games">{[games[0], games[1], games[4]].map((game) => <div className={`gl-phone-game gl-game-${game.id}`} key={game.id}><GameArtwork game={game} /><div><small>{categoryLabels[game.id]}</small><strong>{game.name}</strong><span><Users size={10} /> {game.minPlayers}{game.maxPlayers ? `–${game.maxPlayers}` : '+'} jogadores</span></div><ArrowRight size={18} aria-hidden="true" /></div>)}</div>
      <div className="gl-phone-bottom"><span /><span /><span /></div>
    </div>
    <div className="gl-stage-sticker"><Sparkles size={21} aria-hidden="true" /><span>o rolê merece<br /><strong>mais uma rodada.</strong></span></div>
    <span className="gl-stage-note">Uma prévia do que vem por aí</span>
  </div>
}

const faqs = [
  ['O Galerows já está disponível para baixar?', 'Ainda não. Estamos preparando o lançamento para iPhone e Android. Os links oficiais serão liberados aqui quando o aplicativo estiver disponível na App Store e no Google Play.'],
  ['Dá para jogar pelo navegador ou computador?', 'O site é uma vitrine dos jogos. As partidas serão exclusivas do aplicativo para celular, pensado para acompanhar a galera nos encontros.'],
  ['Cada pessoa precisa de um celular?', 'Depende do jogo. Mímica, Quem Sou Eu e os jogos com mediador podem reunir a turma em torno de um aparelho. Na Adedonha, cada pessoa preenche suas respostas no próprio celular.'],
  ['Precisa de internet para jogar?', 'Os jogos do catálogo foram pensados para partidas presenciais com conteúdo offline. Você vai precisar de internet para baixar o aplicativo e suas atualizações.'],
  ['Com quantas pessoas dá para jogar?', 'Há jogos a partir de 2 pessoas, como Mímica e Nem Ferrando. Impostor da Palavra começa com 3 e Cidade Dorme com 4. Confira a quantidade indicada em cada jogo.'],
]

export function LandingPage() {
  const [activeFilter, setActiveFilter] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const visibleGames = games.filter((game) => activeFilter === 0 || filters[activeFilter].tags.some((tag) => game.tags.includes(tag)))
  const bothAvailable = Boolean(storeLinks.apple && storeLinks.google)
  const anyAvailable = Boolean(storeLinks.apple || storeLinks.google)
  const releaseLabel = bothAvailable ? 'DISPONÍVEL PARA IOS E ANDROID' : anyAvailable ? 'O LANÇAMENTO COMEÇOU' : 'EM BREVE PARA IOS E ANDROID'

  return <div className="gl-landing" id="inicio">
    <a className="gl-skip" href="#conteudo">Pular para o conteúdo</a>
    <header className="gl-header"><div className="gl-container gl-header-inner">
      <Brand />
      <button className="gl-menu-toggle" type="button" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="landing-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      <nav id="landing-nav" className={`gl-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Navegação principal">
        <a href="#jogos" onClick={() => setMenuOpen(false)}>Os jogos</a><a href="#como-funciona" onClick={() => setMenuOpen(false)}>Como funciona</a><a href="#duvidas" onClick={() => setMenuOpen(false)}>Dúvidas</a>
        <a className="gl-nav-cta" href="#baixar" onClick={() => setMenuOpen(false)}>{anyAvailable ? 'Baixar o app' : 'O app vem aí'}<ArrowUpRight size={16} aria-hidden="true" /></a>
      </nav>
    </div></header>

    <main id="conteudo">
      <section className="gl-hero gl-container" aria-labelledby="hero-title">
        <div className="gl-hero-copy"><p className="gl-eyebrow"><span className="gl-status-dot" />{releaseLabel}</p>
          <h1 id="hero-title">Junte a galera.<br />O jogo é <span>por<br className="gl-title-break" /> nossa conta<span className="gl-title-period">.</span></span></h1>
          <p className="gl-hero-description">Blefes, mímicas e palpites que viram história. Seus próximos jogos em grupo, reunidos em um app para celular.</p>
          <StoreButtons />
          <p className="gl-release-note">{anyAvailable ? 'Escolha sua loja e prepare a próxima rodada.' : 'Estamos preparando a próxima rodada. Downloads em breve.'}</p>
          <a className="gl-discover" href="#jogos">Encontre o jogo da sua galera<ArrowDown size={17} aria-hidden="true" /></a>
        </div>
        <HeroStage />
      </section>

      <div className="gl-ticker" aria-label="Jogos para reunir os amigos"><div className="gl-container"><span><Spade /> RESENHA BOA</span><span><Sparkles /> PALPITE DUVIDOSO</span><span><Club /> A RESENHA VIROU JOGO</span><span><Heart /> SÓ MAIS UMA RODADA</span></div></div>

      <section className="gl-games-section gl-container gl-section" id="jogos" aria-labelledby="games-title">
        <div className="gl-section-heading"><div><p className="gl-eyebrow">O CATÁLOGO DA GALERA</p><h2 id="games-title">Cada grupo tem seu jogo.<br /><span>Qual é o de vocês?</span></h2></div><p>Tem quem blefa bem. Quem chuta longe.<br />E quem se entrega na primeira mímica.<br /><strong>Aqui, todo mundo entra na brincadeira.</strong></p></div>
        <div className="gl-catalog-toolbar"><div className="gl-filters" role="group" aria-label="Filtrar jogos">{filters.map((filter, index) => <button type="button" key={filter.label} aria-pressed={activeFilter === index} onClick={() => setActiveFilter(index)}>{filter.label}</button>)}</div><span className="gl-game-count" role="status">{visibleGames.length} jogos para descobrir</span></div>
        <div className="gl-game-grid">{visibleGames.map((game, index) => <article className={`gl-catalog-card gl-game-${game.id}`} key={game.id}>
          <div className="gl-catalog-art"><GameArtwork game={game} /><span className="gl-card-index">{String(index + 1).padStart(2, '0')}</span><span className="gl-card-category">{categoryLabels[game.id]}</span></div>
          <div className="gl-card-body"><h3>{game.name}</h3><p>{game.shortDescription}</p><div className="gl-card-meta"><span><Users size={14} aria-hidden="true" />{game.minPlayers}{game.maxPlayers ? `–${game.maxPlayers}` : '+'} pessoas</span><span><Smartphone size={13} aria-hidden="true" />No app</span></div></div>
        </article>)}</div>
        <div className="gl-catalog-footnote"><Sparkles size={18} aria-hidden="true" /><p>E a mesa vai crescer. <strong>Jogo da Velha, Damas e Ludo</strong> estão nos planos.</p><span>EM DESENVOLVIMENTO</span></div>
      </section>

      <section className="gl-together" id="como-funciona" aria-labelledby="together-title"><div className="gl-container gl-together-grid">
        <div className="gl-table-visual" aria-hidden="true"><span className="gl-table-label">BOM MESMO É JOGAR JUNTO.</span><div className="gl-table-ring" /><div className="gl-table-card gl-table-card-one"><Spade /><span>vale<br />um blefe.</span><small>GALEROWS</small></div><div className="gl-table-card gl-table-card-two"><Sparkles /><span>vale uma<br />gargalhada.</span><small>GALEROWS</small></div><div className="gl-table-bubble"><MessageCircle size={18} /> essa eu sei!</div><span className="gl-table-star">✳</span></div>
        <div className="gl-how-copy"><p className="gl-eyebrow">DO “E AÍ?” AO “MAIS UMA?”</p><h2 id="together-title">O celular na roda.<br /><span>A galera no jogo.</span></h2><p>Na sala, na viagem ou depois do churrasco. Transforme o encontro em uma disputa que rende assunto.</p>
          <ol className="gl-steps"><li><span>01</span><div><h3>Chame a sua galera</h3><p>Reúna os amigos. Tem jogo a partir de duas pessoas.</p></div></li><li><span>02</span><div><h3>Escolham o clima da rodada</h3><p>Mistério, palavras ou aquele desafio em equipes.</p></div></li><li><span>03</span><div><h3>Deixem o jogo puxar a resenha</h3><p>O app guia a partida. Vocês fazem as melhores histórias.</p></div></li></ol>
          <div className="gl-offline-note"><WifiOff size={19} aria-hidden="true" /><span>Jogos presenciais, com conteúdo offline.</span></div>
        </div>
      </div></section>

      <section className="gl-faq gl-container gl-section" id="duvidas" aria-labelledby="faq-title"><div><p className="gl-eyebrow">ANTES DA PRIMEIRA RODADA</p><h2 id="faq-title">Tá, mas<br /><span>como funciona?</span></h2><p>As respostas antes de chamar o grupo.</p></div><div className="gl-faq-list">{faqs.map(([question, answer], index) => <details key={question}><summary><span><small>0{index + 1}</small>{question}</span><Plus size={19} aria-hidden="true" /></summary><p>{index === 0 && anyAvailable ? 'O lançamento começou. Confira as lojas disponíveis na seção de download desta página. As demais opções serão liberadas assim que forem publicadas.' : answer}</p></details>)}</div></section>

      <section className="gl-download gl-container" id="baixar" aria-labelledby="download-title"><div className="gl-download-panel"><Spade className="gl-download-spade" aria-hidden="true" /><Club className="gl-download-club" aria-hidden="true" /><p className="gl-eyebrow"><span className="gl-status-dot" />{releaseLabel}</p><h2 id="download-title">O próximo “bora jogar?”<br /><span>já tem nome.</span></h2><p>Galerows. Jogos da galera, no seu celular.</p><StoreButtons /><p className="gl-download-note"><Check size={14} aria-hidden="true" />{anyAvailable ? 'Baixe pelos links oficiais das lojas.' : 'Em desenvolvimento. A gente se encontra na próxima rodada.'}</p></div></section>
    </main>

    <footer className="gl-footer gl-container"><div className="gl-footer-top"><Brand /><p>Feito para reunir.<br /><strong>E render boas histórias.</strong></p><a href={publicAsset('/privacy.html')}>Política de privacidade<ArrowUpRight size={14} aria-hidden="true" /></a></div><div className="gl-footer-bottom"><span>© {new Date().getFullYear()} Galerows. Jogos da galera.</span><span>FEITO PARA JOGAR JUNTO <Heart size={12} aria-hidden="true" /></span><a href="#inicio">Voltar ao topo<ChevronDown size={14} aria-hidden="true" /></a></div></footer>
  </div>
}
