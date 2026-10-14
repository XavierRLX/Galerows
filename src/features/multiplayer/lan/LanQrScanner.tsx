import jsQR from 'jsqr'
import { useCallback, useEffect, useRef, useState } from 'react'

/** Camera mechanism only. LAN payload validation remains in the invitation decoder. */
export function LanQrScanner({ onClose, onScan }: { onClose: () => void; onScan: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const stopRef = useRef<() => void>(() => undefined)
  const onCloseRef = useRef(onClose)
  const onScanRef = useRef(onScan)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Abrindo câmera…')

  useEffect(() => { onScanRef.current = onScan; onCloseRef.current = onClose }, [onScan, onClose])

  const close = useCallback(() => {
    stopRef.current()
    onCloseRef.current()
  }, [])

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      // Close is the scanner's only interactive control.
      if (event.key === 'Tab') { event.preventDefault(); closeButtonRef.current?.focus() }
    }
    const onBack = (event: Event) => { event.preventDefault(); close() }
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('galerows:back', onBack)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('galerows:back', onBack)
      if (opener?.isConnected) opener.focus()
    }
  }, [close])

  useEffect(() => {
    let active = true
    let frame = 0
    let stream: MediaStream | null = null
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const stop = () => {
      active = false
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach(track => track.stop())
      stream = null
      if (video) video.srcObject = null
    }
    stopRef.current = stop
    const scan = () => {
      const video = videoRef.current
      if (!active || !video || !context) return
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const image = context.getImageData(0, 0, canvas.width, canvas.height)
        const found = jsQR(image.data, image.width, image.height)
        if (found?.data) {
          stop()
          onScanRef.current(found.data)
          return
        }
      }
      frame = requestAnimationFrame(scan)
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => { if (active) setError('Câmera indisponível neste aparelho. Feche e tente entrar pelo código da sala.') })
    } else {
      void navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        .then(async received => {
          if (!active) { received.getTracks().forEach(track => track.stop()); return }
          stream = received
          if (!video) { stop(); return }
          video.srcObject = received
          try { await video.play() }
          catch {
            if (!active) return
            stop()
            setError('Não foi possível iniciar a câmera. Feche e tente novamente.')
            return
          }
          if (!active) return
          setStatus('Aguardando leitura…')
          frame = requestAnimationFrame(scan)
        })
        .catch(reason => {
          if (active) setError(reason instanceof DOMException && reason.name === 'NotAllowedError'
            ? 'Permissão da câmera negada. Autorize o acesso à câmera nas configurações do aparelho e tente novamente.'
            : 'Câmera indisponível. Feche e tente entrar pelo código da sala.')
        })
    }
    return stop
  }, [])

  return <div className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-slate-950 p-5 text-white" role="dialog" aria-modal="true" aria-label="Ler QR da sala">
    <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-black">Ler QR da sala</h2>
      <button className="rounded-xl border border-white/30 px-4 py-2" onClick={close} ref={closeButtonRef}>Fechar</button></div>
    <video aria-label="Imagem da câmera" className="mx-auto mt-8 aspect-square w-full max-w-sm rounded-3xl bg-black object-cover" muted playsInline ref={videoRef} />
    <p className="mt-4 text-center text-slate-300">Aponte para o QR LAN no aparelho do anfitrião.</p>
    {!error && <p className="mt-2 text-center text-slate-300" role="status">{status}</p>}
    {error && <p className="mt-4 rounded-xl bg-rose-900 p-3" role="alert">{error}</p>}
  </div>
}
