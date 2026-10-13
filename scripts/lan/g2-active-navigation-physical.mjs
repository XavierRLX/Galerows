/** G2 physical second phase: host and guest must already be admitted to the same
 * WSS Room on the isolated secureprobe build. Ports: host=9222, guest=9223.
 * No invite, capabilities, fingerprints, or private cards are logged.
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function connect(port) {
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let sequence = 0
  const waiting = new Map()
  ws.onmessage = event => {
    const msg = JSON.parse(event.data)
    const fn = waiting.get(msg.id)
    if (fn) { waiting.delete(msg.id); fn(msg) }
  }
  return {
    eval: expression => new Promise((resolve, reject) => {
      const id = ++sequence
      const timer = setTimeout(() => { waiting.delete(id); reject(new Error('cdp_timeout')) }, 11000)
      waiting.set(id, msg => {
        clearTimeout(timer)
        if (msg.result?.exceptionDetails || msg.error) reject(new Error('cdp_eval_failed'))
        else resolve(msg.result?.result?.value)
      })
      ws.send(JSON.stringify({ id, method:'Runtime.evaluate', params:{ expression, returnByValue:true, awaitPromise:true } }))
    }),
    close: () => ws.close(),
  }
}
async function until(tab, expression, label, timeout = 20000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await tab.eval(expression)) return
    await sleep(250)
  }
  throw new Error('timeout_' + label)
}
async function click(tab, label) {
  const expression = '(() => {const b=[...document.querySelectorAll("button")].find(b=>!b.disabled&&!b.hidden&&(b.getAttribute("aria-label")==='+JSON.stringify(label)+'||b.textContent.trim().includes('+JSON.stringify(label)+')));if(!b)return false;b.click();return true;})()'
  if (!await tab.eval(expression)) throw new Error('button_missing_' + label.replaceAll(' ','_'))
}
async function view(tab) {
  return tab.eval("(() => ({active:!!document.querySelector('[data-testid=pl03-lobby]'), revision:Number(document.querySelector('.pl03-revision strong')?.textContent||0), players:document.querySelectorAll('.pl03-player').length, phase:document.querySelector('.pl03-status-badge')?.textContent?.trim()||'',score:document.querySelector('.pl03-score strong')?.textContent?.trim()||''}))()")
}
async function roundTrip(tab, role) {
  const before = await view(tab)
  if (!before.active || before.players !== 2) throw new Error('room_missing_' + role)
  await click(tab, 'Ver jogos')
  await until(tab, 'Array.from(document.querySelectorAll("button")).some(b=>b.getAttribute("aria-label")?.startsWith("Conhecer "))','catalog_' + role)
  const catalog = await tab.eval('Array.from(document.querySelectorAll("button")).filter(b=>b.getAttribute("aria-label")?.startsWith("Conhecer ")).length')
  if (catalog !== 10) throw new Error('catalog_incomplete_' + role)
  if (await tab.eval('Boolean(document.querySelector(".pl03-secret-value"))')) throw new Error('secret_exposed_to_catalog')
  await click(tab, 'Voltar à sala')
  await until(tab, 'Boolean(document.querySelector("[data-testid=pl03-lobby]"))','return_' + role)
  const after = await view(tab)
  if (!after.active || after.revision !== before.revision || after.players !== before.players || after.phase !== before.phase || after.score !== before.score) throw new Error('state_changed_' + role)
}
const host = await connect(9222)
const guest = await connect(9223)
let steps = 0
function checkpoint(label) { steps++; console.log('G2_STEP', steps, label) }
try {
  const a = await view(host), b = await view(guest)
  if (!a.active || !b.active || a.players !== 2 || b.players !== 2 || a.revision !== b.revision) throw new Error('precondition_two_members_failed')
  checkpoint('two_members_authenticated')
  await roundTrip(host, 'host')
  checkpoint('host_room_catalog_room')
  await roundTrip(guest, 'guest')
  checkpoint('guest_room_catalog_room')
  await click(host, 'Selecionar Contagem em equipe')
  await until(guest, 'document.querySelector(".pl03-chosen-head strong")?.textContent.includes("Contagem em equipe")','game_selected')
  await click(host, 'Salvar regras')
  await until(guest, 'document.body.textContent.includes("Regras confirmadas para esta rodada")','rules_synced')
  await click(host, 'Estou pronto')
  await click(guest, 'Estou pronto')
  await until(host, 'document.querySelector(".pl03-players-foot")?.textContent.includes("2 / 2 prontos")','ready')
  await click(host, 'Iniciar rodada')
  await until(guest, 'document.querySelector(".pl03-status-badge")?.textContent === "Partida em andamento"','playing')
  await click(guest, 'Somar 1')
  await until(host, 'document.querySelector(".pl03-score strong")?.textContent.trim().startsWith("1")','score_one')
  checkpoint('wss_commands_before_navigation')
  await roundTrip(host, 'host_during_game')
  await roundTrip(guest, 'guest_during_game')
  checkpoint('room_and_game_persisted')
  await click(guest, 'Somar 1')
  await until(host, 'document.querySelector(".pl03-score strong")?.textContent.trim().startsWith("2")','score_two')
  checkpoint('guest_wss_command_after_navigation')
  await click(guest, 'Sair da sala')
  await click(guest, 'Sim, sair da sala')
  await until(host, 'document.querySelectorAll(".pl03-player").length === 1','guest_left')
  await click(host, 'Encerrar sala')
  await click(host, 'Sim, encerrar sala')
  await until(host, 'Boolean(document.querySelector("[data-testid=pl03-entry]"))','host_closed')
  checkpoint('terminal_actions')
  console.log('G2_PHYSICAL_NAVIGATION_PASS steps='+steps)
} catch (error) {
  console.error('G2_PHYSICAL_NAVIGATION_INCOMPLETE', error instanceof Error?error.message:'unknown_error')
  process.exitCode = 1
} finally { host.close(); guest.close() }
