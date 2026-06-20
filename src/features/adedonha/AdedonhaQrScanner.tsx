import jsQR from 'jsqr'
import { Camera, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'

export function AdedonhaQrScanner({ onClose, onScan }: { onClose: () => void; onScan: (value: string) => void }) {
  const { t } = useTranslation('adedonha')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let frame = 0
    let active = true
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })

    const stop = () => {
      active = false
      window.cancelAnimationFrame(frame)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    const scan = () => {
      const video = videoRef.current
      if (!active || !video || !context) return
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const image = context.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(image.data, image.width, image.height)
        if (code?.data) {
          onScan(code.data)
          stop()
          return
        }
      }
      frame = window.requestAnimationFrame(scan)
    }

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
        }
        frame = window.requestAnimationFrame(scan)
      })
      .catch(() => setError(t('scanner.cameraError')))

    return stop
  }, [onScan, t])

  return <div className="fixed inset-0 z-50 bg-slate-950 text-white">
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><div className="flex items-center gap-2 font-black"><Camera className="text-yellow-300" size={20} />{t('scanner.title')}</div><Button aria-label={t('scanner.close')} size="icon" variant="ghost" onClick={onClose}><X size={20} /></Button></div>
      <section className="flex flex-1 flex-col justify-center px-5 py-6 text-center">
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[2rem] border border-yellow-300/40 bg-black">
          <video className="size-full object-cover" muted playsInline ref={videoRef} />
          <div className="pointer-events-none absolute inset-8 rounded-3xl border-4 border-yellow-300/80 shadow-[0_0_0_999px_rgba(2,6,23,0.48)]" />
        </div>
        <p className="mx-auto mt-5 max-w-sm text-sm leading-6 text-slate-300">{t('scanner.description')}</p>
        {error ? <p className="mx-auto mt-4 max-w-sm rounded-2xl bg-rose-500/10 p-4 text-sm font-bold text-rose-200" role="alert">{error}</p> : null}
      </section>
    </div>
  </div>
}
