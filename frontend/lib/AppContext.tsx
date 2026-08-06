'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  MedicalProfile,
  SymptomEntry,
  ChatMessage,
  Alert,
  mockMedicalProfile,
  mockChatHistory,
  User,
} from './mockData'
import { api, getToken } from './api'

interface AppContextType {
  user: User | null
  setUser: (user: User | null) => void

  medicalProfile: MedicalProfile
  updateMedicalProfile: (profile: Partial<MedicalProfile>) => void

  symptoms: SymptomEntry[]
  addSymptom: (symptom: SymptomEntry) => void
  deleteSymptom: (id: string) => void

  chatMessages: ChatMessage[]
  addChatMessage: (message: ChatMessage) => void

  alerts: Alert[]
  dismissAlert: (id: string) => void

  menopauseStage: 'Perimenopause' | 'Menopause' | 'Postmenopause'
  setMenopauseStage: (stage: 'Perimenopause' | 'Menopause' | 'Postmenopause') => void

  forecast: any | null
  refresh: () => void

  moodScore: number
  sleepScore: number
  stressScore: number
  healthScore: number
  exerciseDietScore: number
}

const AppContext = createContext<AppContextType | undefined>(undefined)

// Map the backend's camelCase profile payload onto the frontend MedicalProfile.
function toProfile(p: any): MedicalProfile {
  return {
    ...mockMedicalProfile,
    userId: 'me',
    height: p.height ?? mockMedicalProfile.height,
    weight: p.weight ?? mockMedicalProfile.weight,
    smoking: p.smoking ?? 'never',
    alcohol: p.alcohol ?? 'none',
    exerciseFrequency: p.exerciseFrequency ?? 'moderate',
    occupation: p.occupation ?? '',
    menstrualHistory: p.menstrualHistory ?? '',
    pregnancyHistory: p.pregnancyHistory ?? 0,
    pcos: !!p.pcos,
    thyroid: !!p.thyroid,
    diabetes: !!p.diabetes,
    bloodPressure: p.bloodPressure ?? '',
    cancerHistory: p.cancerHistory ?? '',
    familyHistory: p.familyHistory ?? [],
    medications: p.medications ?? [],
    allergies: p.allergies ?? [],
    diet: p.diet ?? '',
    fileUploads: mockMedicalProfile.fileUploads,
  }
}

// Map the frontend MedicalProfile patch onto the backend payload.
function toProfilePayload(p: Partial<MedicalProfile> & { menopauseStage?: string }): any {
  const out: any = {}
  const keys: (keyof MedicalProfile)[] = [
    'height', 'weight', 'smoking', 'alcohol', 'exerciseFrequency', 'occupation',
    'menstrualHistory', 'pregnancyHistory', 'pcos', 'thyroid', 'diabetes',
    'bloodPressure', 'cancerHistory', 'familyHistory', 'medications', 'allergies', 'diet',
  ]
  for (const k of keys) if (k in p) out[k] = (p as any)[k]
  if (p.menopauseStage) out.menopauseStage = p.menopauseStage
  return out
}

function toSymptom(s: any): SymptomEntry {
  return {
    id: String(s.id),
    symptomName: s.symptomName,
    severity: s.severity,
    frequency: s.frequency,
    duration: s.duration,
    notes: s.notes || '',
    date: new Date(s.date),
  }
}

function toAlert(a: any): Alert {
  return {
    id: String(a.id),
    type: a.type,
    title: a.title,
    message: a.message,
    severity: a.severity,
    dueDate: a.dueDate ? new Date(a.dueDate) : undefined,
    createdAt: new Date(a.createdAt),
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [medicalProfile, setMedicalProfile] = useState<MedicalProfile>(mockMedicalProfile)
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(mockChatHistory)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [forecast, setForecast] = useState<any | null>(null)
  const [menopauseStage, setMenopauseStageState] = useState<
    'Perimenopause' | 'Menopause' | 'Postmenopause'
  >('Perimenopause')

  const [moodScore] = useState(68)
  const [sleepScore] = useState(55)
  const [stressScore] = useState(42)
  const [healthScore] = useState(72)
  const [exerciseDietScore] = useState(65)

  async function refresh() {
    if (!getToken()) return
    try {
      const [p, s, a] = await Promise.all([
        api.getProfile(),
        api.listSymptoms(),
        api.listAlerts(),
      ])
      setMedicalProfile(toProfile(p))
      if (p.menopauseStage) setMenopauseStageState(p.menopauseStage)
      setSymptoms((s || []).map(toSymptom))
      // Run a forecast (creates the prediction alert + schedules the reminder),
      // then reload alerts to include it.
      if ((s || []).length > 0) {
        try {
          setForecast(await api.forecast({ horizon_days: 3 }))
          setAlerts(((await api.listAlerts()) || []).map(toAlert))
        } catch {
          setAlerts((a || []).map(toAlert))
        }
      } else {
        setAlerts((a || []).map(toAlert))
      }
    } catch {
      /* not logged in yet or backend down — keep current state */
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const updateMedicalProfile = (profile: Partial<MedicalProfile>) => {
    setMedicalProfile((prev) => ({ ...prev, ...profile }))
    api.updateProfile(toProfilePayload(profile)).then(refresh).catch(() => {})
  }

  const setMenopauseStage = (stage: 'Perimenopause' | 'Menopause' | 'Postmenopause') => {
    setMenopauseStageState(stage)
    api.updateProfile({ menopauseStage: stage }).catch(() => {})
  }

  const addSymptom = (symptom: SymptomEntry) => {
    setSymptoms((prev) => [symptom, ...prev]) // optimistic
    api
      .addSymptom({
        symptomName: symptom.symptomName,
        severity: symptom.severity,
        frequency: symptom.frequency,
        duration: symptom.duration,
        notes: symptom.notes,
        date: (symptom.date instanceof Date ? symptom.date : new Date(symptom.date))
          .toISOString()
          .slice(0, 10),
      })
      .then(refresh)
      .catch(() => {})
  }

  const deleteSymptom = (id: string) => {
    setSymptoms((prev) => prev.filter((s) => s.id !== id))
    api.deleteSymptom(id).catch(() => {})
  }

  const addChatMessage = (message: ChatMessage) => {
    setChatMessages((prev) => [...prev, message])
  }

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    api.dismissAlert(id).catch(() => {})
  }

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        medicalProfile,
        updateMedicalProfile,
        symptoms,
        addSymptom,
        deleteSymptom,
        chatMessages,
        addChatMessage,
        alerts,
        dismissAlert,
        menopauseStage,
        setMenopauseStage,
        forecast,
        refresh,
        moodScore,
        sleepScore,
        stressScore,
        healthScore,
        exerciseDietScore,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
