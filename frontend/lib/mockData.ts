// Data Types
export interface User {
  id: string
  email: string
  name: string
  dob: string
  address: string
  createdAt: Date
}

export interface MedicalProfile {
  /** Display name — stored on the account row, edited on this screen. */
  name: string
  // Personal Info
  height: number // cm
  weight: number // kg
  // Lifestyle
  smoking: 'never' | 'former' | 'current'
  alcohol: 'none' | 'moderate' | 'frequent'
  exerciseFrequency: 'sedentary' | 'light' | 'moderate' | 'vigorous'
  occupation: string
  // Medical History
  menstrualHistory: string
  pregnancyHistory: number // count
  pcos: boolean
  thyroid: boolean
  diabetes: boolean
  bloodPressure: string
  cancerHistory: string
  // Family History
  familyHistory: string[]
  // Medications & Allergies
  medications: string[]
  allergies: string[]
  // Diet
  diet: string
}


export interface SymptomEntry {
  id: string
  symptomName: string
  severity: number // 1-10
  frequency: 'multiple_daily' | 'daily' | 'few_weekly' | 'weekly' | 'monthly'
  duration: number // hours
  notes: string
  date: Date
}

export interface Alert {
  id: string
  type: 'prediction' | 'medication' | 'intervention' | 'appointment' | 'symptom'
  title: string
  message: string
  severity: 'low' | 'medium' | 'high'
  dueDate?: Date
  createdAt: Date
}

export interface Article {
  id: string
  title: string
  excerpt: string
  category: 'diet' | 'mental_wellbeing' | 'supplements' | 'symptoms'
  image: string
  source: string
  publishedAt: Date
}

export interface FAQ {
  id: string
  question: string
  answer: string
  category: string
}

export interface CommunityComment {
  id: string
  faqId: string
  author: string
  content: string
  createdAt: Date
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// Mock Data

export const SYMPTOM_LIST = [
  'Hot flashes',
  'Night sweats',
  'Mood swings',
  'Depression',
  'Anxiety',
  'Brain fog',
  'Memory issues',
  'Sleep problems',
  'Fatigue',
  'Joint pain',
  'Headache',
  'Palpitations',
  'Weight gain',
  'Hair loss',
  'Skin changes',
  'Libido changes',
  'Sexual discomfort',
  'Urinary symptoms',
  'Period irregularity',
  'Abnormal bleeding',
  'Energy loss',
  'Stress',
  'Pain',
]

export const MENOPAUSE_STAGES = ['Perimenopause', 'Menopause', 'Postmenopause'] as const
export type MenopauseStage = (typeof MENOPAUSE_STAGES)[number]

export const mockMedicalProfile: MedicalProfile = {
  name: '',
  height: 165,
  weight: 68,
  smoking: 'never',
  alcohol: 'moderate',
  exerciseFrequency: 'moderate',
  occupation: 'Software Engineer',
  menstrualHistory: 'Regular until age 47, now irregular',
  pregnancyHistory: 2,
  pcos: false,
  thyroid: false,
  diabetes: false,
  bloodPressure: '120/80',
  cancerHistory: 'None',
  familyHistory: ['Mother had early menopause at 45'],
  medications: ['Vitamin D3', 'Magnesium'],
  allergies: ['Penicillin'],
  diet: 'Balanced with focus on calcium and omega-3',
}

export const mockSymptomEntries: SymptomEntry[] = [
  {
    id: 'symptom-1',
    symptomName: 'Hot flashes',
    severity: 7,
    frequency: 'daily',
    duration: 15,
    notes: 'Morning episodes, mostly controlled',
    date: new Date(Date.parse('2026-08-04T12:00:00Z')),
  },
  {
    id: 'symptom-2',
    symptomName: 'Night sweats',
    severity: 6,
    frequency: 'few_weekly',
    duration: 30,
    notes: 'Worse after stressful days',
    date: new Date(Date.parse('2026-08-03T12:00:00Z')),
  },
  {
    id: 'symptom-3',
    symptomName: 'Brain fog',
    severity: 5,
    frequency: 'daily',
    duration: 0,
    notes: 'Afternoon slumps',
    date: new Date(Date.parse('2026-08-04T12:00:00Z')),
  },
  {
    id: 'symptom-4',
    symptomName: 'Sleep problems',
    severity: 6,
    frequency: 'few_weekly',
    duration: 0,
    notes: 'Takes 30+ minutes to fall asleep',
    date: new Date(Date.parse('2026-08-02T12:00:00Z')),
  },
  {
    id: 'symptom-5',
    symptomName: 'Mood swings',
    severity: 4,
    frequency: 'weekly',
    duration: 0,
    notes: 'Manageable with exercise',
    date: new Date(Date.parse('2026-08-03T12:00:00Z')),
  },
]

export const mockAlerts: Alert[] = [
  {
    id: 'alert-1',
    type: 'prediction',
    title: 'Hot Flash Predicted',
    message: 'Likelihood of hot flash in next 4 hours: 72%',
    severity: 'medium',
    createdAt: new Date(),
  },
  {
    id: 'alert-2',
    type: 'medication',
    title: 'Medication Reminder',
    message: 'Time for your Vitamin D3 supplement',
    severity: 'low',
    dueDate: new Date(),
    createdAt: new Date(),
  },
  {
    id: 'alert-3',
    type: 'intervention',
    title: 'Medical Recommendation',
    message: 'If symptoms persist beyond 3 months, consult your doctor',
    severity: 'medium',
    createdAt: new Date(),
  },
  {
    id: 'alert-4',
    type: 'appointment',
    title: 'Appointment Reminder',
    message: 'Annual checkup scheduled for March 15, 2024',
    severity: 'low',
    dueDate: new Date('2024-03-15'),
    createdAt: new Date(),
  },
]

export const mockFAQs: FAQ[] = [
  {
    id: 'faq-1',
    question: 'What are hot flashes?',
    answer:
      'Hot flashes are sudden feelings of heat in the upper body, often accompanied by flushing, sweating, and a rapid heartbeat. They are a common symptom of menopause.',
    category: 'symptoms',
  },
  {
    id: 'faq-2',
    question: 'How long do hot flashes last?',
    answer:
      'Hot flashes typically last from 30 seconds to 10 minutes. They can occur multiple times per day and may continue for several years during and after menopause.',
    category: 'symptoms',
  },
  {
    id: 'faq-3',
    question: 'What can help with night sweats?',
    answer:
      'Keep your bedroom cool, wear breathable pajamas, use moisture-wicking bedding, and stay hydrated. Some people find relief with HRT or other medications.',
    category: 'treatment',
  },
  {
    id: 'faq-4',
    question: 'Are there dietary changes that help?',
    answer:
      'Reducing caffeine, alcohol, and spicy foods may help. Increasing plant-based foods, staying hydrated, and ensuring adequate calcium and vitamin D intake are beneficial.',
    category: 'diet',
  },
  {
    id: 'faq-5',
    question: 'When should I see a doctor?',
    answer:
      'Seek medical attention if hot flashes interfere with daily life, if you have severe mood changes, or if symptoms persist beyond 3 years.',
    category: 'medical',
  },
]

export const mockArticles: Article[] = [
  {
    id: 'article-1',
    title: 'Best Foods to Combat Menopause Symptoms',
    excerpt:
      'Discover which foods can help alleviate hot flashes, night sweats, and mood swings during menopause.',
    category: 'diet',
    image: '/articles/foods.jpg',
    source: 'Health & Wellness',
    publishedAt: new Date(Date.parse('2026-07-31T12:00:00Z')),
  },
  {
    id: 'article-2',
    title: 'Mindfulness Techniques for Menopause',
    excerpt:
      'Learn meditation and breathing exercises that can significantly reduce anxiety and stress during this transition.',
    category: 'mental_wellbeing',
    image: '/articles/mindfulness.jpg',
    source: 'Mental Health Today',
    publishedAt: new Date(Date.parse('2026-07-29T12:00:00Z')),
  },
  {
    id: 'article-3',
    title: 'Natural Supplements for Hot Flashes',
    excerpt:
      'Explore evidence-based supplements like black cohosh, red clover, and sage that may help manage symptoms.',
    category: 'supplements',
    image: '/articles/supplements.jpg',
    source: 'Nutritional Science',
    publishedAt: new Date(Date.parse('2026-07-26T12:00:00Z')),
  },
  {
    id: 'article-4',
    title: 'Exercise Guide for Menopausal Women',
    excerpt:
      'Understand which types of exercise are most effective for managing weight gain and improving mood during menopause.',
    category: 'symptoms',
    image: '/articles/exercise.jpg',
    source: 'Fitness Weekly',
    publishedAt: new Date(Date.parse('2026-08-02T12:00:00Z')),
  },
]

export const mockChatHistory: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    content: 'Hello! I\'m your menopause companion. How can I help you today?',
    timestamp: new Date(Date.parse('2026-08-05T11:50:00Z')),
  },
  {
    id: 'msg-2',
    role: 'user',
    content: 'I\'ve been having more frequent hot flashes lately',
    timestamp: new Date(Date.parse('2026-08-05T11:52:00Z')),
  },
  {
    id: 'msg-3',
    role: 'assistant',
    content:
      'I understand. Hot flashes can be challenging. Have you noticed any patterns or triggers? For example, do they happen at specific times of day or in response to certain activities?',
    timestamp: new Date(Date.parse('2026-08-05T11:53:00Z')),
  },
]

export const mockPopulationStats = {
  averageSymptoms: 8.5,
  averageSeverity: 5.2,
  mostCommon: 'Hot flashes',
  avgDuration: '7 months',
}

export const mockScores = {
  mood: 68,
  sleep: 55,
  stress: 42,
  health: 72,
  exerciseDiet: 65,
}

export const mockJourneyComment = `You're in the early stages of menopause (perimenopause). Your symptoms are consistent with this stage, with hot flashes being the most prevalent. Based on your current patterns, we predict increased night sweats in the coming month. Stay hydrated and maintain your exercise routine!`
