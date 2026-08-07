'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  MedicalProfile,
  SymptomEntry,
  ChatMessage,
  MenopauseStage,
  Alert,
  mockMedicalProfile,
  mockChatHistory,
  User,
} from './mockData'
import { api, getToken } from './api'
import { setStoredUserName } from './auth'

interface AppContextType {
  user: User | null
  setUser: (user: User | null) => void

  medicalProfile: MedicalProfile
  updateMedicalProfile: (profile: Partial<MedicalProfile>) => Promise<void>

  symptoms: SymptomEntry[]
  addSymptom: (symptom: SymptomEntry) => Promise<void>
  deleteSymptom: (id: string) => Promise<void>

  chatMessages: ChatMessage[]
  addChatMessage: (message: ChatMessage) => void

  alerts: Alert[]
  dismissAlert: (id: string) => void

  menopauseStage: MenopauseStage
  setMenopauseStage: (stage: MenopauseStage) => Promise<void>

  forecast: any | null
  refresh: () => Promise<void>

  /** True until the first load of profile/symptoms/alerts settles. */
  loading: boolean

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
    name: p.name ?? '',
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
  }
}

// Map the frontend MedicalProfile patch onto the backend payload.
function toProfilePayload(p: Partial<MedicalProfile> & { menopauseStage?: string }): any {
  const out: any = {}
  const keys: (keyof MedicalProfile)[] = [
    'name', 'height', 'weight', 'smoking', 'alcohol', 'exerciseFrequency', 'occupation',
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
  const [loading, setLoading] = useState(true)
  const [menopauseStage, setMenopauseStageState] = useState<MenopauseStage>('Perimenopause')

  const [moodScore] = useState(68)
  const [sleepScore] = useState(55)
  const [stressScore] = useState(42)
  const [healthScore] = useState(72)
  const [exerciseDietScore] = useState(65)

  async function refresh() {
    if (!getToken()) {
      setLoading(false)
      return
    }
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
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const updateMedicalProfile = async (profile: Partial<MedicalProfile>) => {
    setMedicalProfile((prev) => ({ ...prev, ...profile }))
    try {
      await api.updateProfile(toProfilePayload(profile))
      // The header and greeting read the name from the cached user, so a rename
      // has to land there too or it looks unsaved until the next sign-in.
      if (profile.name?.trim()) {
        const updated = setStoredUserName(profile.name.trim())
        if (updated) setUser(updated)
      }
      await refresh()
    } catch {
      /* keep the optimistic value — the next refresh will reconcile */
    }
  }

  const setMenopauseStage = async (stage: MenopauseStage) => {
    const previous = menopauseStage
    setMenopauseStageState(stage) // optimistic
    try {
      await api.updateProfile({ menopauseStage: stage })
      // Stage is a model input, so re-run the forecast against the new value.
      await refresh()
    } catch {
      setMenopauseStageState(previous) // save failed — don't show a value the DB doesn't have
      throw new Error('Could not save your menopause stage. Please try again.')
    }
  }

  const addSymptom = async (symptom: SymptomEntry) => {
    setSymptoms((prev) => [symptom, ...prev]) // optimistic
    try {
      await api.addSymptom({
        symptomName: symptom.symptomName,
        severity: symptom.severity,
        frequency: symptom.frequency,
        duration: symptom.duration,
        notes: symptom.notes,
        date: (symptom.date instanceof Date ? symptom.date : new Date(symptom.date))
          .toISOString()
          .slice(0, 10),
      })
      await refresh()
    } catch {
      /* keep the optimistic entry — the next refresh will reconcile */
    }
  }

  const deleteSymptom = async (id: string) => {
    setSymptoms((prev) => prev.filter((s) => s.id !== id))
    try {
      await api.deleteSymptom(id)
    } catch {
      /* already removed locally — the next refresh will reconcile */
    }
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
        loading,
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
