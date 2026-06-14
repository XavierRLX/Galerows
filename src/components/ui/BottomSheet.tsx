import type { PropsWithChildren } from 'react'
import { Modal } from './Modal'

export function BottomSheet(props: PropsWithChildren<{ open: boolean; title: string; onClose: () => void }>) {
  return <Modal {...props} />
}
