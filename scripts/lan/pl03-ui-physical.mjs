/** PL-03 two-Android physical UX, no tokens/private cards printed or persisted. */
import process from 'node:process'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'
import jsQR from 'jsqr'
const run = promisify(execFile)
const adb = process.env.HOME + '/Library/Android/sdk/platform-tools/adb'
const serialGuest = 'RXGL30N4F3F'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function connect(port) {
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
  const url = targets.find(t => t.type === 'page')?.webSocketDebuggerUrl
  if (!url) throw new Error('no_android_webview_' + port)
  const ws = new WebSocket(url)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('cdp_connect_failure_' + port))
  })
  let nextId = 0
  const pending = new Map()
  ws.onmessage = event => {
    const message = JSON.parse(event.data)
    const cb = pending.get(message.id)
    if (cb) { pending.delete(message.id); cb(message) }
  }
  return {
    eval: expression => new Promise((resolve, reject) => {
      const id = ++nextId
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('cdp_eval_timeout')) }, 8000)
      pending.set(id, response => {
        clearTimeout(timer)
        if (response.error || response.result?.exceptionDetails) return reject(new Error('cdp_eval_error'))
        resolve(response.result?.result?.value)
      })
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate',
        params: { expression, returnByValue: true, awaitPromise: true } }))
    }),
    close: () => ws.close(),
  }
}
async function waitFor(session, script, label, timeout = 16000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await session.eval(script)) return
    await sleep(270)
  }
  throw new Error('timeout_' + label)
}
async function click(session, label) {
  const ok = await session.eval(`(() => {
    const el = Array.from(document.querySelectorAll('button')).find(b =>
      !b.disabled && (b.getAttribute('aria-label') === ${JSON.stringify(label)} ||
      b.textContent.trim().replace(/\\s+/g,' ').includes(${JSON.stringify(label)})))
    if (!el) return false
    el.click(); return true
  })()`)
  if (!ok) throw new Error('button_unavailable_' + label)
}
async function fill(session, id, value) {
  const ok = await session.eval(`(() => {
    const el = document.getElementById(${JSON.stringify(id)})
    if (!el) return false
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  if (!ok) throw new Error('field_unavailable_' + id)
}
function view(session) {
  return session.eval(`(() => ({
    active: Boolean(document.querySelector('[data-testid="pl03-lobby"]')),
    entry: Boolean(document.querySelector('[data-testid="pl03-entry"]')),
    revision: Number(document.querySelector('.pl03-revision strong')?.textContent || 0),
    phase: document.querySelector('.pl03-status-badge')?.textContent?.trim() || '',
    members: document.querySelectorAll('.pl03-player').length,
    count: document.querySelector('.pl03-count')?.textContent?.trim() || '',
    ready: document.querySelector('.pl03-players-foot span')?.textContent?.trim() || '',
    game: document.querySelector('.pl03-chosen-head strong')?.textContent?.trim() || '',
    score: document.querySelector('.pl03-score strong')?.textContent?.trim() || '',
    hasSecretControl: Boolean(document.querySelector('button[aria-label="Revelar minha carta"]')),
    revealed: Boolean(document.querySelector('.pl03-secret-value')),
    disconnected: Boolean(document.querySelector('button:not([hidden])')) && Array.from(document.querySelectorAll('button')).some(b => !b.hidden && b.textContent.trim() === 'Reconectar'),
    error: document.querySelector('[role="alert"]')?.textContent?.trim()?.slice(0,160) || '',
  }))()`)
}
const host = await connect(9222)
const guest = await connect(9223)
const evidence = []
let guestWifiChanged = false
async function checkpoint(label) {
  const h = await view(host), g = await view(guest)
  evidence.push({ step: label, h, g })
  console.log('STEP', label, JSON.stringify({host:h,guest:g}))
}
try {
  await waitFor(host, 'Boolean(document.querySelector("[data-testid=pl03-entry]"))', 'host_entry')
  await waitFor(guest, 'Boolean(document.querySelector("[data-testid=pl03-entry]"))', 'guest_entry')
  await checkpoint('entry_on_both')
  await click(host, 'Criar uma sala')
  await waitFor(host, 'Boolean(document.querySelector("[data-testid=pl03-lobby]"))', 'host_created')
  const invite = await host.eval('document.getElementById("pl03-invite-text")?.value')
  const code = await host.eval('document.querySelector(".pl03-code strong")?.textContent?.trim()')
  const qrSrc = await host.eval('document.querySelector(".pl03-qr img")?.src')
  if (!invite?.startsWith('galerows-lan-v2:') || !code || !qrSrc?.startsWith('data:image/png;base64,')) {
    throw new Error('host_invitation_missing')
  }
  const { data, info } = await sharp(Buffer.from(qrSrc.split(',')[1], 'base64'))
    .ensureAlpha().raw().toBuffer({resolveWithObject:true})
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data
  if (decoded !== invite) {
    console.log('QR_SAFE_DIAGNOSTICS', JSON.stringify({ imageWidth: info.width, imageHeight: info.height,
      qrDecoded: Boolean(decoded), qrLength: decoded?.length ?? 0, manualLength: invite.length }))
    throw new Error('qr_does_not_match_manual_invite')
  }
  await checkpoint('host_created_qr_decoded')
  await click(guest, 'Entrar numa sala')
  await waitFor(guest, 'Boolean(document.getElementById("pl03-invite-input"))', 'guest_invite_form')
  await fill(guest, 'pl03-invite-input', invite)
  await fill(guest, 'pl03-code-input', code)
  await waitFor(guest, 'Boolean(Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim().includes("Entrar na sala")&&!b.disabled))', 'join_button')
  await click(guest, 'Entrar na sala')
  await waitFor(guest, 'Boolean(document.querySelector("[data-testid=pl03-lobby]"))', 'guest_admitted', 22000)
  await waitFor(host, 'document.querySelectorAll(".pl03-player").length === 2', 'host_two_members')
  await checkpoint('two_members_admitted')
  const after = await host.eval('document.getElementById("pl03-invite-text")?.value')
  if (after === invite) throw new Error('stale_host_invite_after_guest_admission')
  await checkpoint('invitation_rotated')

  await click(host, 'Selecionar Cartas secretas')
  await waitFor(host, 'document.querySelector(".pl03-chosen-head strong")?.textContent.includes("Cartas secretas")', 'toy_selected')
  await waitFor(guest, 'document.querySelector(".pl03-chosen-head strong")?.textContent.includes("Cartas secretas")', 'guest_toy_selected')
  await click(host, 'Salvar regras')
  await waitFor(guest, 'document.body.textContent.includes("Regras confirmadas para esta rodada")', 'guest_toy_rules')
  await click(host, 'Estou pronto')
  await waitFor(host, 'document.querySelector(".pl03-players-foot")?.textContent.includes("1 / 2 prontos")', 'host_ready_toy')
  await click(guest, 'Estou pronto')
  await waitFor(host, 'document.querySelector(".pl03-players-foot")?.textContent.includes("2 / 2 prontos")', 'both_ready_toy')
  await checkpoint('toy_ready')
  await click(host, 'Iniciar rodada')
  await waitFor(guest, 'document.querySelector(".pl03-status-badge")?.textContent === "Partida em andamento"', 'toy_playing')
  if (await guest.eval('Boolean(document.querySelector(".pl03-secret-value"))')) throw new Error('guest_private_default_visible')
  await click(guest, 'Revelar minha carta')
  await waitFor(guest, 'Boolean(document.querySelector(".pl03-secret-value"))', 'private_guest_revealed')
  await click(guest, 'Ocultar minha carta')
  await waitFor(guest, '!document.querySelector(".pl03-secret-value")', 'private_guest_hidden')
  await checkpoint('toy_playing_private_reveal')

  // Drop only guest Wi-Fi (without touching host's room/socket) and prove native resume.
  await run(adb, ['-s',serialGuest,'shell','svc','wifi','disable'])
  guestWifiChanged = true
  await waitFor(guest, 'Array.from(document.querySelectorAll("button")).some(b=>!b.hidden&&b.textContent.trim()==="Reconectar")', 'guest_disconnected_redacted', 30000)
  if (await guest.eval('Boolean(document.querySelector(".pl03-secret-value"))')) throw new Error('private_still_visible_disconnected')
  await checkpoint('guest_disconnected')
  await run(adb, ['-s',serialGuest,'shell','svc','wifi','enable'])
  guestWifiChanged = false
  const deadline = Date.now() + 25000
  let sameNetwork = false
  while (Date.now() < deadline) {
    const {stdout} = await run(adb, ['-s',serialGuest,'shell','ip','-4','-o','addr','show','wlan0'])
    if (stdout.includes('192.168.0.89/24')) { sameNetwork = true; break }
    await sleep(650)
  }
  if (!sameNetwork) throw new Error('guest_wifi_did_not_rejoin')
  await click(guest, 'Reconectar')
  await waitFor(guest, 'document.querySelector(".pl03-feedback")?.textContent.includes("Reconectado")', 'guest_resumed', 22000)
  await waitFor(guest, 'Boolean(document.querySelector("button[aria-label=\\"Revelar minha carta\\"]"))', 'private_projection_restored')
  await checkpoint('guest_resumed_same_toy')
  await click(host, 'Encerrar rodada')
  await waitFor(guest, 'document.querySelector(".pl03-status-badge")?.textContent === "Fim de rodada"', 'toy_results')
  await click(host, 'Voltar ao lobby')
  await waitFor(guest, 'document.querySelector(".pl03-status-badge")?.textContent === "Na sala"', 'toy_lobby')
  await checkpoint('toy_results_and_same_lobby')
  await click(host, 'Selecionar Contagem em equipe')
  await waitFor(guest, 'document.querySelector(".pl03-chosen-head strong")?.textContent.includes("Contagem em equipe")', 'counter_selected')
  await click(host, 'Salvar regras')
  await waitFor(guest, 'document.body.textContent.includes("Regras confirmadas para esta rodada")', 'guest_counter_rules')
  await click(host, 'Estou pronto')
  await waitFor(host, 'document.querySelector(".pl03-players-foot")?.textContent.includes("1 / 2 prontos")', 'host_ready_counter')
  await click(guest, 'Estou pronto')
  await waitFor(host, 'document.querySelector(".pl03-players-foot")?.textContent.includes("2 / 2 prontos")', 'both_ready_counter')
  await click(host, 'Iniciar rodada')
  await waitFor(guest, 'document.querySelector(".pl03-status-badge")?.textContent === "Partida em andamento"', 'counter_playing')
  if (await guest.eval('Boolean(document.querySelector(".pl03-secret"))')) throw new Error('toy_secret_survived_counter')
  await click(guest, 'Somar 1')
  await waitFor(host, 'document.querySelector(".pl03-score strong")?.textContent.includes("1")', 'counter_applied_both')
  await checkpoint('counter_increment')
  await click(guest, 'Sair da sala')
  await waitFor(guest, 'Boolean(document.querySelector("[role=dialog]"))', 'guest_leave_modal')
  await click(guest, 'Sim, sair da sala')
  await waitFor(guest, 'Boolean(document.querySelector("[data-testid=pl03-entry]"))', 'guest_left')
  await waitFor(host, 'document.querySelectorAll(".pl03-player").length === 1', 'host_membership_removed')
  await checkpoint('guest_left')
  await click(host, 'Encerrar sala')
  await click(host, 'Sim, encerrar sala')
  await waitFor(host, 'Boolean(document.querySelector("[data-testid=pl03-entry]"))', 'host_closed')
  await checkpoint('host_closed')
  console.log('PL03_PHYSICAL_UI_PASS steps=' + evidence.length)
} catch(e) {
  console.error('PL03_PHYSICAL_UI_INCOMPLETE', e instanceof Error ? e.message : String(e))
  console.error('HOST_SAFE', JSON.stringify(await view(host).catch(()=>({unavailable:true}))))
  console.error('GUEST_SAFE', JSON.stringify(await view(guest).catch(()=>({unavailable:true}))))
  process.exitCode = 1
} finally {
  if (guestWifiChanged) await run(adb, ['-s',serialGuest,'shell','svc','wifi','enable']).catch(()=>undefined)
  host.close(); guest.close()
}
