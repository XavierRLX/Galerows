import jsQR from 'jsqr'
import { useEffect, useRef, useState } from 'react'

/** Camera mechanism only. LAN payload validation remains in the invitation decoder. */
export function LanQrScanner({ onClose, onScan }: { onClose: () => void; onScan: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const onScanRef = useRef(onScan)
  const [error, setError] = useState('')

  useEffect(() => { onScanRef.current = onScan }, [onScan])

  useEffect(() => {
    let active = true
    let frame = 0
    let stream: MediaStream | null = null
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const stop = () => {
      active = false
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach(track => track.stop())
      stream = null
    }
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
      queueMicrotask(() => { if (active) setError('Câmera indisponível neste aparelho. Digite o convite.') })
    } else {
      void navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        .then(received => {
          if (!active) { received.getTracks().forEach(track => track.stop()); return }
          stream = received
          if (videoRef.current) {
            videoRef.current.srcObject = received
            void videoRef.current.play().catch(() => {
              stop()
              setError('Não foi possível iniciar a câmera. Digite o convite.')
            })
          }
          frame = requestAnimationFrame(scan)
        })
        .catch(reason => {
          if (active) setError(reason instanceof DOMException && reason.name === 'NotAllowedError'
            ? 'Permissão da câmera negada. Digite o convite.' : 'Câmera indisponível. Digite o convite.')
        })
    }
    return stop
  }, [])

  return <div className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-slate-950 p-5 text-white" role="dialog" aria-label="Ler QR da sala">
    <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-black">Ler QR da sala</h2>
      <button className="rounded-xl border border-white/30 px-4 py-2" onClick={onClose}>Digitar convite</button></div>
    <video aria-label="Imagem da câmera" className="mx-auto mt-8 aspect-square w-full max-w-sm rounded-3xl bg-black object-cover" muted playsInline ref={videoRef} />
    <p className="mt-4 text-center text-slate-300">Aponte para o QR LAN no aparelho do anfitrião.</p>
    {error && <p className="mt-4 rounded-xl bg-rose-900 p-3" role="alert">{error}</p>}
  </div>
}
