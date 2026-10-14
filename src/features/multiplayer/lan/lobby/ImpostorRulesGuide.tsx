import { useEffect } from 'react'
import { BookOpen, Check, Eye, MessageCircleQuestion, ShieldQuestion, Trophy, Users, X } from 'lucide-react'

/** Explains the existing rules without leaving or suspending the persistent LAN Room. */
export function ImpostorRulesGuide({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
    }
    const onAndroidBack = (event: Event) => { event.preventDefault(); onClose() }
    document.addEventListener('keydown', onKey)
    window.addEventListener('galerows:back', onAndroidBack)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('galerows:back', onAndroidBack)
    }
  }, [onClose])
  return <div className="pl03-guide-backdrop" onPointerDown={event => {
    if (event.target === event.currentTarget) onClose()
  }}>
    <article className="pl03-guide" role="dialog" aria-modal="true" aria-labelledby="pl03-guide-heading"
      tabIndex={-1}>
      <header className="pl03-guide-header">
        <div><span><BookOpen size={15}/> GUIA DO JOGO</span>
          <h2 id="pl03-guide-heading">Como jogar Impostor da Palavra</h2></div>
        <button type="button" onClick={onClose} aria-label="Fechar explicação"><X size={21}/></button>
      </header>
      <div className="pl03-guide-content">
        <section><h3><Users size={18}/> Objetivo</h3>
          <p>Todo mundo tenta descobrir quem é o impostor sem revelar a palavra secreta.
            O impostor tenta passar despercebido e pode tentar descobrir a palavra no final.
            Cada jogador vê sua identidade apenas no próprio celular.</p>
        </section>
        <section><h3><ShieldQuestion size={18}/> Modos de identidade</h3>
          <dl>
            <dt>Sem palavra</dt><dd>Todos recebem a mesma palavra, menos o impostor.
              Ele sabe que é o impostor, mas não recebe a palavra e precisa improvisar.</dd>
            <dt>Com dica</dt><dd>O impostor sabe que é o impostor e recebe uma dica relacionada
              à palavra, sem saber exatamente qual é.</dd>
            <dt>Palavra alternativa</dt><dd>O impostor recebe uma palavra diferente da palavra
              dos demais e não sabe que é o impostor. Ele dá pistas acreditando
              que sua palavra também é a correta.</dd>
          </dl>
        </section>
        <section><h3><MessageCircleQuestion size={18}/> Como conversar</h3>
          <dl>
            <dt>Uma palavra por pessoa</dt><dd>Cada jogador fala em voz alta uma palavra
              ou dica relacionada à sua identidade, sem falar o segredo diretamente.</dd>
            <dt>Perguntas guiadas</dt><dd>Uma pergunta vale para todos os jogadores,
              como “Onde você mais vê isso?”. O anfitrião pode trocá-la antes da votação.
              Vocês também podem fazer outras perguntas livremente durante a conversa.</dd>
          </dl>
        </section>
        <section><h3><Eye size={18}/> Etapas da rodada</h3>
          <ol>
            <li>Todos entram na tela de identidade. A palavra ou dica se esconde sozinha após 5 segundos;
              é possível consultar novamente até a votação.</li>
            <li>O aplicativo avisa quando todos visualizaram. O anfitrião pode sortear quem começa.</li>
            <li>Conversam pessoalmente e levantam suspeitas. O cronômetro, se ativado, não encerra a discussão.</li>
            <li>Cada pessoa escolhe e confirma seu voto em segredo no próprio aparelho.
              Em caso de empate, ocorre desempate.</li>
            <li>O impostor pode tentar adivinhar a palavra. O resultado e os pontos aparecem para todos.</li>
            <li>O anfitrião escolhe Jogar novamente ou Voltar ao lobby. A sala e o placar permanecem.</li>
          </ol>
        </section>
        <section><h3><Trophy size={18}/> Pontuação</h3>
          <dl>
            <dt>Clássica</dt><dd>Se o grupo vence, os jogadores que não são impostores recebem
              os pontos clássicos. Se o impostor vence, ele recebe os pontos clássicos.</dd>
            <dt>Por acertos</dt><dd>Cada jogador que votou no verdadeiro impostor ganha 1 ponto.
              Se a maioria absoluta acertou, cada acertador recebe mais 1 ponto.
              O impostor ganha 1 ponto se escapar da acusação coletiva e mais 1 ponto extra
              se descobrir a palavra. Os bônus podem se acumular.</dd>
          </dl>
        </section>
      </div>
      <footer className="pl03-guide-footer">
        <button type="button" onClick={onClose}><Check size={18}/> Entendi, voltar à sala</button>
      </footer>
    </article>
  </div>
}
