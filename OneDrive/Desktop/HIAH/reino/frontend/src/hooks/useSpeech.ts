import { useRef, useState, useCallback } from 'react'

// ── Browser SpeechRecognition type declarations ────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}
interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}
interface ISpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: ((ev: Event) => void) | null
  onresult: ((ev: SpeechRecognitionEvent) => void) | null
  onend: ((ev: Event) => void) | null
  onerror: ((ev: Event) => void) | null
  start(): void
  stop(): void
  abort(): void
}
interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition
}

declare global {
  interface Window {
    SpeechRecognition?: ISpeechRecognitionConstructor
    webkitSpeechRecognition?: ISpeechRecognitionConstructor
  }
}

// ── Hook ──────────────────────────────────────────────────────
interface Options {
  onTranscript?: (t: string) => void
}

export function useSpeech({ onTranscript }: Options = {}) {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking]   = useState(false)
  const recRef = useRef<ISpeechRecognition | null>(null)

  const startListening = useCallback(() => {
    const SR: ISpeechRecognitionConstructor | undefined =
      window.SpeechRecognition ?? window.webkitSpeechRecognition

    if (!SR) {
      alert('Speech recognition is not supported in this browser. Try Chrome.')
      return
    }

    const rec = new SR()
    rec.lang = 'en-KE'
    rec.continuous = false
    rec.interimResults = false

    rec.onstart  = () => setIsListening(true)
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const t = e.results[0][0].transcript.trim()
      onTranscript?.(t)
    }
    rec.onend    = () => setIsListening(false)
    rec.onerror  = () => setIsListening(false)

    recRef.current = rec
    rec.start()
  }, [onTranscript])

  const stopListening = useCallback(() => {
    recRef.current?.stop()
    setIsListening(false)
  }, [])

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()

    const utt  = new SpeechSynthesisUtterance(text)
    utt.lang   = 'en-KE'
    utt.pitch  = 1.1
    utt.rate   = 0.95

    const voices = window.speechSynthesis.getVoices()
    const female = voices.find(v =>
      /female|samantha|karen|victoria|fiona|moira/i.test(v.name) ||
      (v.lang.startsWith('en') && v.name.includes('Google UK English Female'))
    )
    if (female) utt.voice = female

    utt.onstart = () => setIsSpeaking(true)
    utt.onend   = () => setIsSpeaking(false)
    utt.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utt)
  }, [])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  return { isListening, isSpeaking, startListening, stopListening, speak, stopSpeaking }
}
