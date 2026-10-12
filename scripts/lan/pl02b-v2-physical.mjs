import process from 'node:process'

async function connect(port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const url = targets.find(t => t.type === 'page')?.webSocketDebuggerUrl
  if (!url) throw new Error('no_webview_' + port)
  const ws = new WebSocket(url)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('cannot_connect_cdp_' + port))
  })
  let seq = 0
  const pending = new Map()
  ws.onmessage = event => {
    const response = JSON.parse(event.data)
    const resolver = pending.get(response.id)
    if (resolver) { pending.delete(response.id); resolver(response) }
  }
  async function evalJS(expression) {
    const id = ++seq
    const response = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('cdp_timeout')), 5000)
      pending.set(id, r => { clearTimeout(timer); resolve(r) })
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate',
        params: { expression, returnByValue: true, awaitPromise: true } }))
    })
    if (response.error) throw new Error('cdp_error_' + JSON.stringify(response.error))
    const r = response.result
    if (r?.exceptionDetails) throw new Error('page_exception_' + r.exceptionDetails.text)
    return r?.result?.value
  }
  return { evalJS, close: () => ws.close() }
}

async function waitFor(session, predicate, name, timeoutMs = 14000) {
  const expires = Date.now() + timeoutMs
  while (Date.now() < expires) {
    const current = await session.evalJS(predicate)
    if (current) return current
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('timeout_waiting_for_' + name)
}
async function click(session, label) {
  const ok = await session.evalJS(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(label)});
    if (!b) return false; b.click(); return true;
  })()`)
  if (!ok) throw new Error('button_missing_' + label)
}
async function input(session, aria, value) {
  const script = `(() => {
    const el = document.querySelector('[aria-label="${aria}"]');
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', {bubbles:true}));
    return true;
  })()`
  if (!await session.evalJS(script)) throw new Error('input_missing_' + aria)
}
async function status(session) {
  return session.evalJS(`({
    status: document.querySelector('[data-testid="v2-status"]')?.textContent || 'missing',
    snapshot: (() => { try {return JSON.parse(document.querySelector('[data-testid="v2-state"]')?.textContent || 'null')}catch{return null}})(),
    log: document.querySelector('[data-testid="v2-log"]')?.textContent?.split('\\n').slice(-3)
  })`)
}
const host = await connect(9222)
const guest = await connect(9223)
const evidence = []
async function capture(label) {
  const h = await status(host), g = await status(guest)
  evidence.push({ step: label, host: h, guest: g })
  process.stdout.write(JSON.stringify({ step:label,
    host: { status: h.status, phase:h.snapshot?.phase, rev:h.snapshot?.revision,
      game:h.snapshot?.game, session:h.snapshot?.sessionId, members:h.snapshot?.players?.length },
    guest: { status: g.status, phase:g.snapshot?.phase, rev:g.snapshot?.revision,
      game:g.snapshot?.game, session:g.snapshot?.sessionId, members:g.snapshot?.players?.length,
      private:g.snapshot?.hasPrivate } }) + '\n')
}
try {
  console.log('UI', await status(host), await status(guest))
  await click(host, 'Start v2 host')
  await waitFor(host, `document.querySelector('[data-testid="v2-status"]')?.textContent.includes('hosting')`, 'host_ready')
  const invite = await host.evalJS(`document.querySelector('[aria-label="v2 invite"]')?.value`)
  const code = await host.evalJS(`document.querySelector('[data-testid="v2-code"]')?.textContent`)
  if (!invite?.startsWith('galerows-lan-v2:') || !/^[0-9A-Z-]+$/.test(code || '')) throw new Error('missing_invite_or_code')
  await capture('host_started')
  await click(guest, 'Join as guest')
  await input(guest, 'v2 invite', invite)
  await input(guest, 'v2 code', code)
  await click(guest, 'Connect v2 guest')
  await waitFor(guest, `document.querySelector('[data-testid="v2-status"]')?.textContent.includes('admitted')`, 'guest_admitted')
  await capture('admitted')
  await click(host, 'Select toy A')
  await waitFor(host, `document.querySelector('[data-testid="v2-log"]')?.textContent.includes('Host SELECT_GAME = accepted')`, 'selected_toy')
  await click(host, 'Configure toy A')
  await waitFor(host, `document.querySelector('[data-testid="v2-log"]')?.textContent.includes('Host CONFIGURE_GAME = accepted')`, 'configured_toy')
  await click(host, 'Host ready')
  await waitFor(host, `document.querySelector('[data-testid="v2-log"]')?.textContent.includes('Host READY = accepted')`, 'host_ready_toy')
  await click(guest, 'Guest ready')
  await waitFor(guest, `document.querySelector('[data-testid="v2-log"]')?.textContent.includes('Guest READY = accepted')`, 'guest_ready_toy')
  await click(host, 'Start game')
  await waitFor(guest, `JSON.parse(document.querySelector('[data-testid="v2-state"]')?.textContent || '{}').phase === 'playing'`, 'playing_toy')
  await capture('toy_A_playing')
  const toy = (await status(guest)).snapshot
  await click(guest, 'Drop socket')
  await waitFor(guest, `document.querySelector('[data-testid="v2-status"]')?.textContent.includes('disconnected')`, 'guest_disconnected')
  await click(guest, 'Resume v2 guest')
  await waitFor(guest, `document.querySelector('[data-testid="v2-status"]')?.textContent.includes('resumed')`, 'guest_resumed')
  await capture('toy_A_resumed')
  const resumed = (await status(guest)).snapshot
  if (toy?.sessionId !== resumed?.sessionId || !resumed?.hasPrivate) throw new Error('private_resume_mismatch')
  await click(host, 'End game')
  await waitFor(guest, `JSON.parse(document.querySelector('[data-testid="v2-state"]')?.textContent || '{}').phase === 'results'`, 'toy_results')
  await click(host, 'Back to lobby')
  await waitFor(guest, `JSON.parse(document.querySelector('[data-testid="v2-state"]')?.textContent || '{}').phase === 'lobby'`, 'toy_lobby')
  await capture('returned_to_lobby')
  await click(host, 'Select counter B')
  await waitFor(host, `document.querySelector('[data-testid="v2-state"]')?.textContent.includes('counter')`, 'selected_counter')
  await click(host, 'Configure counter B')
  await waitFor(host, `document.querySelector('[data-testid="v2-state"]')?.textContent.includes('configuring')`, 'configured_counter')
  await click(host, 'Host ready')
  await waitFor(host, `document.querySelector('[data-testid="v2-log"]')?.textContent.split('Host READY = accepted').length >= 3`, 'host_ready_counter')
  await click(guest, 'Guest ready')
  await waitFor(guest, `document.querySelector('[data-testid="v2-log"]')?.textContent.split('Guest READY = accepted').length >= 3`, 'guest_ready_counter')
  await click(host, 'Start game')
  await waitFor(guest, `JSON.parse(document.querySelector('[data-testid="v2-state"]')?.textContent || '{}').phase === 'playing'`, 'counter_playing')
  await capture('counter_B_playing')
  const counter = (await status(guest)).snapshot
  if (counter?.sessionId === toy?.sessionId || counter?.hasPrivate) throw new Error('counter_secret_or_session_violation')
  await click(guest, 'Increment counter B')
  await waitFor(guest, `document.querySelector('[data-testid="v2-log"]')?.textContent.includes('Guest INCREMENT = accepted')`, 'counter_increment')
  await waitFor(guest, `JSON.parse(document.querySelector('[data-testid="v2-state"]')?.textContent || '{}').revision >= 17`, 'counter_revision_applied')
  await capture('counter_increment')
  await click(guest, 'Leave Room v2')
  await waitFor(guest, `document.querySelector('[data-testid="v2-status"]')?.textContent.includes('left_confirmed')`, 'guest_left')
  await capture('left_confirmed')
  await click(host, 'Close Room')
  await waitFor(host, `document.querySelector('[data-testid="v2-status"]')?.textContent.includes('room_closed')`, 'host_closed')
  await capture('host_closed')
  console.log('PHYSICAL_V2_PASS steps=' + evidence.length)
} catch (e) {
  console.error('PHYSICAL_V2_INCOMPLETE', e instanceof Error ? e.message : String(e))
  console.error('HOST_STATE', JSON.stringify(await status(host)))
  console.error('GUEST_STATE', JSON.stringify(await status(guest)))
  process.exitCode = 1
} finally { host.close(); guest.close() }
