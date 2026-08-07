'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/lib/AppContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingBlock, Spinner } from '@/components/ui/spinner'
import {
  ChevronDown,
  Save,
  AlertCircle,
} from 'lucide-react'

// Section and FormField MUST stay at module scope. Declaring them inside
// MedicalProfilePage creates a new component type on every render, so React
// unmounts and remounts the subtree on each keystroke — which destroys the
// <input> DOM node and drops focus after every character typed.
function Section({
  id,
  title,
  isOpen,
  onToggle,
  children,
}: {
  id: string
  title: string
  isOpen: boolean
  onToggle: (id: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between p-4 bg-card hover:bg-background transition-colors"
      >
        <h3 className="font-bold text-foreground">{title}</h3>
        <ChevronDown
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <div className="p-4 bg-card/50 border-t border-border space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}

type FormFieldProps = {
  label: string
  onChange: (value: any) => void
  placeholder?: string
} & (
  | { type: 'checkbox'; value: boolean; options?: never }
  | { type: 'select'; value: string; options: string[] }
  | { type?: 'text' | 'number'; value: string | number; options?: never }
)

// Narrow on `props` rather than destructuring in the signature — TypeScript
// cannot discriminate a union once its members are pulled apart.
function FormField(props: FormFieldProps) {
  const { label, onChange } = props

  if (props.type === 'select') {
    return (
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
        <select
          value={props.value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
        >
          {props.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (props.type === 'checkbox') {
    return (
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={props.value}
          onChange={(e) => onChange(e.target.checked)}
          className="w-5 h-5 rounded border-border"
        />
        <span className="text-foreground">{label}</span>
      </label>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      <Input
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={props.placeholder ?? label}
      />
    </div>
  )
}

export default function MedicalProfilePage() {
  const { medicalProfile, updateMedicalProfile, loading } = useApp()
  const [expandedSection, setExpandedSection] = useState<string | null>(
    'personal'
  )
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState(medicalProfile)

  // Re-sync the form when the real profile arrives from the backend.
  useEffect(() => {
    setFormData(medicalProfile)
  }, [medicalProfile])

  const toggleSection = (id: string) =>
    setExpandedSection((prev) => (prev === id ? null : id))

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateMedicalProfile(formData)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-4 py-6 border-b border-border mb-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-1">
            Medical Profile
          </h1>
          <p className="text-foreground/60">
            Keep your health information updated for personalized insights
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingBlock label="Loading your medical profile…" />
      ) : (
      <div className="max-w-4xl mx-auto px-4">
        {saved && (
          <div className="mb-4 p-3 bg-secondary border border-primary/30 text-primary rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Changes saved successfully!
          </div>
        )}

        {/* Personal Information */}
        <Section id="personal" title="1. Personal Information"
          isOpen={expandedSection === 'personal'} onToggle={toggleSection}>
          <FormField
            label="Name"
            value={formData.name}
            onChange={(v) => handleInputChange('name', v)}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Height (cm)"
              type="number"
              value={formData.height}
              onChange={(v) => handleInputChange('height', v === '' ? '' : Number(v))}
            />
            <FormField
              label="Weight (kg)"
              type="number"
              value={formData.weight}
              onChange={(v) => handleInputChange('weight', v === '' ? '' : Number(v))}
            />
          </div>
        </Section>

        {/* Lifestyle */}
        <Section id="lifestyle" title="2. Lifestyle"
          isOpen={expandedSection === 'lifestyle'} onToggle={toggleSection}>
          <FormField
            label="Smoking Status"
            type="select"
            value={formData.smoking}
            onChange={(v) => handleInputChange('smoking', v)}
            options={['never', 'former', 'current']}
          />
          <FormField
            label="Alcohol Consumption"
            type="select"
            value={formData.alcohol}
            onChange={(v) => handleInputChange('alcohol', v)}
            options={['none', 'moderate', 'frequent']}
          />
          <FormField
            label="Exercise Frequency"
            type="select"
            value={formData.exerciseFrequency}
            onChange={(v) => handleInputChange('exerciseFrequency', v)}
            options={['sedentary', 'light', 'moderate', 'vigorous']}
          />
          <FormField
            label="Occupation"
            value={formData.occupation}
            onChange={(v) => handleInputChange('occupation', v)}
          />
        </Section>

        {/* Medical History */}
        <Section id="medical" title="3. Medical History"
          isOpen={expandedSection === 'medical'} onToggle={toggleSection}>
          <FormField
            label="Menstrual History"
            value={formData.menstrualHistory}
            onChange={(v) => handleInputChange('menstrualHistory', v)}
          />
          <FormField
            label="Pregnancy Count"
            type="number"
            value={formData.pregnancyHistory}
            onChange={(v) => handleInputChange('pregnancyHistory', v === '' ? '' : Number(v))}
          />
          <FormField
            label="PCOS"
            type="checkbox"
            value={formData.pcos}
            onChange={(v) => handleInputChange('pcos', v)}
          />
          <FormField
            label="Thyroid Condition"
            type="checkbox"
            value={formData.thyroid}
            onChange={(v) => handleInputChange('thyroid', v)}
          />
          <FormField
            label="Diabetes"
            type="checkbox"
            value={formData.diabetes}
            onChange={(v) => handleInputChange('diabetes', v)}
          />
          <FormField
            label="Blood Pressure"
            value={formData.bloodPressure}
            onChange={(v) => handleInputChange('bloodPressure', v)}
            placeholder="e.g., 120/80"
          />
          <FormField
            label="Cancer History"
            value={formData.cancerHistory}
            onChange={(v) => handleInputChange('cancerHistory', v)}
          />
        </Section>

        {/* Family History */}
        <Section id="family" title="4. Family History"
          isOpen={expandedSection === 'family'} onToggle={toggleSection}>
          <FormField
            label="Family History Notes"
            value={formData.familyHistory.join(', ')}
            onChange={(v) =>
              handleInputChange('familyHistory', v.split(', '))
            }
          />
        </Section>

        {/* Medications */}
        <Section id="medications" title="5. Medications"
          isOpen={expandedSection === 'medications'} onToggle={toggleSection}>
          <FormField
            label="Current Medications (comma-separated)"
            value={formData.medications.join(', ')}
            onChange={(v) =>
              handleInputChange('medications', v.split(',').map((m: string) => m.trim()))
            }
          />
        </Section>

        {/* Allergies */}
        <Section id="allergies" title="6. Allergies"
          isOpen={expandedSection === 'allergies'} onToggle={toggleSection}>
          <FormField
            label="Known Allergies (comma-separated)"
            value={formData.allergies.join(', ')}
            onChange={(v) =>
              handleInputChange('allergies', v.split(',').map((a: string) => a.trim()))
            }
          />
        </Section>

        {/* Diet */}
        <Section id="diet" title="7. Diet"
          isOpen={expandedSection === 'diet'} onToggle={toggleSection}>
          <FormField
            label="Dietary Information"
            value={formData.diet}
            onChange={(v) => handleInputChange('diet', v)}
          />
        </Section>

        {/* Save Button */}
        <div className="sticky bottom-0 left-0 right-0 bg-background border-t border-border p-4">
          <div className="max-w-4xl mx-auto">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 text-white flex items-center justify-center gap-2"
            >
              {saving ? (
                <><Spinner size="sm" /> Saving…</>
              ) : (
                <><Save className="w-5 h-5" /> Save Medical Profile</>
              )}
            </Button>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
