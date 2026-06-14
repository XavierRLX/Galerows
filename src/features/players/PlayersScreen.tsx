import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { usePlayersStore } from './players.store'

export function PlayersScreen() {
  const { group, hydrated, error, load, setGroupName, add, rename, remove, move } = usePlayersStore()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [groupNameDraft, setGroupNameDraft] = useState<string | null>(null)

  useEffect(() => { if (!hydrated) void load() }, [hydrated, load])

  if (!group) return <div className="min-h-dvh"><Header backTo="/" title="Minha Galera" /><p className="p-5 text-slate-400">Carregando...</p></div>

  const submitPlayer = async () => {
    if (await add(newName)) setNewName('')
  }
  const submitRename = async () => {
    if (editingId && await rename(editingId, editingName)) setEditingId(null)
  }

  return (
    <div className="min-h-dvh pb-10">
      <Header backTo="/" title="Minha Galera" />
      <section className="px-5 py-7">
        <div className="flex items-center gap-3"><div className="rounded-2xl bg-violet-400 p-3 text-slate-950"><Users /></div><div><h1 className="text-2xl font-black">Seu grupo de jogadores</h1><p className="text-sm text-slate-400">Salve uma vez e reutilize em qualquer jogo.</p></div></div>

        <label className="mt-7 block text-sm font-bold text-slate-300" htmlFor="group-name">Nome da galera</label>
        <div className="mt-2 flex gap-2">
          <input id="group-name" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 outline-none focus:border-lime-400" maxLength={40} value={groupNameDraft ?? group.name} onChange={(event) => setGroupNameDraft(event.target.value)} />
          <Button variant="secondary" onClick={async () => { if (await setGroupName(groupNameDraft ?? group.name)) setGroupNameDraft(null) }}>Salvar</Button>
        </div>

        <form className="mt-7 flex gap-2" onSubmit={(event) => { event.preventDefault(); void submitPlayer() }}>
          <input aria-label="Nome do jogador" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 outline-none focus:border-lime-400" maxLength={32} placeholder="Nome do jogador" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <Button aria-label="Adicionar jogador" type="submit"><Plus size={19} />Adicionar</Button>
        </form>
        {error ? <p className="mt-3 text-sm font-semibold text-rose-300" role="alert">{error}</p> : null}

        <Card className="mt-5 overflow-hidden">
          {group.players.length === 0 ? <p className="p-6 text-center text-slate-400">Adicione quem costuma jogar com você.</p> : group.players.map((player, index) => (
            <div className="flex min-h-16 items-center gap-2 border-b border-white/10 px-3 last:border-0" key={player.id}>
              <span className="w-7 text-center text-sm font-bold text-slate-500">{index + 1}</span>
              {editingId === player.id ? <input aria-label={`Editar ${player.name}`} autoFocus className="min-h-10 min-w-0 flex-1 rounded-xl border border-lime-400 bg-slate-950 px-3" value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void submitRename() }} /> : <span className="min-w-0 flex-1 truncate font-semibold">{player.name}</span>}
              {editingId === player.id ? <Button size="icon" variant="secondary" onClick={() => void submitRename()}>OK</Button> : <Button aria-label={`Editar ${player.name}`} size="icon" variant="ghost" onClick={() => { setEditingId(player.id); setEditingName(player.name) }}><Pencil size={17} /></Button>}
              <Button aria-label={`Mover ${player.name} para cima`} disabled={index === 0} size="icon" variant="ghost" onClick={() => void move(player.id, -1)}><ArrowUp size={17} /></Button>
              <Button aria-label={`Mover ${player.name} para baixo`} disabled={index === group.players.length - 1} size="icon" variant="ghost" onClick={() => void move(player.id, 1)}><ArrowDown size={17} /></Button>
              <Button aria-label={`Excluir ${player.name}`} size="icon" variant="ghost" onClick={() => void remove(player.id)}><Trash2 className="text-rose-300" size={17} /></Button>
            </div>
          ))}
        </Card>
      </section>
    </div>
  )
}
