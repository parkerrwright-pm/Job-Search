# UI Wireframe & Design Guide

## Design System

### Color Palette
```
Primary: #2563eb (Blue)
Secondary: #64748b (Slate)
Success: #10b981 (Green)
Warning: #f59e0b (Amber)
Danger: #ef4444 (Red)
Background: #f8fafc (Off-white)
Border: #e2e8f0 (Light gray)
```

### Typography
```
Headings: Inter, sans-serif
Body: Inter, sans-serif
Monospace: Fira Code
```

### Spacing
```
xs: 4px
sm: 8px
md: 16px
lg: 24px
xl: 32px
2xl: 48px
```

---

## Page Layouts

### 1. Dashboard (Command Center)

```
┌─────────────────────────────────────────────────────────────┐
│  PM Job Search                                 Dashboard     │
└─────────────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┬──────────┐
│  42 Jobs │  8 This  │  3 Follow │  5 Intv │
│ Pipeline │  Week    │  -ups     │ Upcoming│
└──────────┴──────────┴──────────┴──────────┘

┌──────────────────────────┬──────────────────┐
│                          │ Quick Actions    │
│  Jobs by Stage           │ ➕ Add Job       │
│  (Bar Chart)             │ 🧠 Tailor Resume│
│                          │ 🔍 Research     │
│                          │ 🎤 Interview    │
└──────────────────────────┴──────────────────┘
```

### 2. Job Pipeline (Kanban Board)

```
┌─────────────────────────────────────────────────────────────┐
│ Job Pipeline    [Search...]                      [+ Add Job]│
└─────────────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┬──────────┐
│💾 SAVED  │📤 APPLIED│📞 SCREEN │👔 MANAGER│
│   (15)   │  (20)    │   (4)    │   (3)    │
├──────────┼──────────┼──────────┼──────────┤
│┌────────┐│┌────────┐│┌────────┐│┌────────┐│
││ Google │││ Google │││ OpenAI │││ Google ││
││  PM    │││  PM    │││  PM    │││ PM Lead││
││        │││$180-200│││$170-210│││Offer   ││
││[View]  │││[View]  │││[View]  │││[View]  ││
│└────────┘│└────────┘│└────────┘│└────────┘│
│┌────────┐│┌────────┐│          │          │
││Stripe  │││ Figma  ││          │          │
││  PM    │││  Sr PM ││          │          │
││ $150k  │││$200-250││          │          │
││[View]  │││[View]  ││          │          │
│└────────┘│└────────┘│          │          │
└──────────┴──────────┴──────────┴──────────┘
```

### 3. Resume Tailor

```
┌─────────────────────────────────────────────────────────────┐
│ AI Resume Tailor Engine                                     │
│ Optimize your resume for specific job descriptions          │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────┬──────────────────────────┐
│  Your Resume             │  Job Description         │
│  ┌────────────────────┐ │  ┌────────────────────┐  │
│  │                    │ │  │                    │  │
│  │ [Paste resume]     │ │  │ [Paste JD]         │  │
│  │                    │ │  │                    │  │
│  │                    │ │  │                    │  │
│  └────────────────────┘ │  └────────────────────┘  │
└──────────────────────────┴──────────────────────────┘

            [🧠 Generate Tailored Resume]

┌─────────────────────────────────────────────────────────────┐
│ Results:                                                    │
├─────────────────────────────────────────────────────────────┤
│ Missing Keywords:                                           │
│ [machine learning] [LLM] [prompt engineering]               │
│                                                             │
│ Rewritten Bullets: [Copy All]                               │
│ • Led AI recommendation engine launch...                    │
│ • Implemented data-driven prioritization...                 │
│                                                             │
│ New Summary: [Copy]                                         │
│ Experienced PM with 6+ years driving product strategy...   │
└─────────────────────────────────────────────────────────────┘
```

### 4. Company Research

```
┌─────────────────────────────────────────────────────────────┐
│ Company Research Engine                                     │
│ Get instant competitive insights and strategic context       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┬─────────────────┐
│ Company Name: [OpenAI ________] │ [🔍 Research]   │
└─────────────────────────────────┴─────────────────┘

Job Description (optional):
[Paste JD for enhanced research...]

[🔍 Research Company]

┌─────────────────────────────────┬──────────────────┐
│ Overview                        │ Business Model   │
│ OpenAI is an AI research and    │ API-based revenue│
│ deployment company focused on   │ from enterprise  │
│ ensuring AI systems benefit     │ and consumer     │
│ humanity...                     │ users            │
└─────────────────────────────────┴──────────────────┘

┌─────────────────────────────────┬──────────────────┐
│ Product Strategy                │ Target Customers │
│ • Focus on LLMs                 │ • Enterprise     │
│ • Multimodal capabilities       │ • Developers     │
│ • API scaling                   │ • SMBs           │
│ • Safety & alignment            │ • Researchers    │
└─────────────────────────────────┴──────────────────┘

┌─────────────────────────────────┬──────────────────┐
│ Key Competitors                 │ Challenges       │
│ • Anthropic                     │ • Regulation     │
│ • Google DeepMind               │ • Competition    │
│ • Meta AI                       │ • Safety        │
│ • Microsoft (Azure)             │ • Scalability    │
└─────────────────────────────────┴──────────────────┘
```

### 5. Interview Prep

```
┌─────────────────────────────────────────────────────────────┐
│ Interview Preparation - Senior PM at Google                 │
│ Interview Date: Jan 28 | Prep Started: Jan 15              │
└─────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┐
│ Behavioral   │ Product      │ Company      │
│ Questions    │ Thinking     │ Specific     │
│    (15)      │    (10)      │     (5)      │
└──────────────┴──────────────┴──────────────┘

Behavioral Question 1:
"Tell me about a time you had to make a decision with incomplete data"

📝 Suggested Approach:
• Use STAR method
• Focus on your decision framework
• Highlight data you gathered vs. intuition

[Practice] [Skip] [Next]

STAR Story Bank:

1. 🎯 Launched AI Recommendation Engine
   Problem: Low retention in content discovery
   Action: Led design sprint with ML team
   Result: 45% increase in user engagement

2. 🎯 Managed Conflicting Stakeholder Feedback
   Problem: Product and Sales disagreed on roadmap
   Action: Created data-driven prioritization framework
   Result: Aligned teams, shipped 3 features

[Edit Stories] [Randomize Practice]
```

### 6. Job Details Page

```
┌─────────────────────────────────────────────────────────────┐
│  ◀  Senior Product Manager - Google  [Edit] [Delete]        │
└─────────────────────────────────────────────────────────────┘

Header Section:
┌────────────────────────────────────────────────────────────┐
│ 🔵 Google | Senior Product Manager                         │
│ 📍 Mountain View, CA  💰 $200k-250k  ⭐ HIGH Priority      │
│ 📅 Applied: Jan 15, 2024  Follow-up: Jan 25, 2024          │
├────────────────────────────────────────────────────────────┤
│ [Apply] [Tailor Resume] [Research Company] [Interview Prep]│
└────────────────────────────────────────────────────────────┘

Status Timeline:
┌────────────────────────────────────────────────────────────┐
│ Application Timeline:                                       │
│ • Saved - Jan 15, 2024                                      │
│ • Applied - Jan 15, 2024                                    │
│ • Interview - Jan 28, 2024 ← Next step                      │
└────────────────────────────────────────────────────────────┘

Recruiter Info:
┌────────────────────────────────────────────────────────────┐
│ 👤 Sarah Chen (Recruiter)                                  │
│ 📧 sarah@google.com  📱 (555) 123-4567                    │
│ 🔗 Referred by: John Smith                                 │
│ Last contact: Jan 18, 2024                                 │
└────────────────────────────────────────────────────────────┘

Job Description & Analysis:
┌────────────────────────────────────────────────────────────┐
│ Job Description (Original)                                 │
│ [Full description...]                                      │
│                                                             │
│ ATS Analysis Score: 84/100 ⭐                              │
│ Missing Keywords: [machine learning] [LLM]                 │
│ Recommendation: Strong match                               │
└────────────────────────────────────────────────────────────┘

Notes:
┌────────────────────────────────────────────────────────────┐
│ Personal Notes:                                             │
│ • Strong cultural fit                                       │
│ • Team focuses on AI/ML which aligns with my background    │
│ • Sarah mentioned interest in interviewing next week       │
│                                                             │
│ [Edit Notes]                                                │
└────────────────────────────────────────────────────────────┘
```

---

## Component States

### Job Card States

**Normal:**
```
┌─────────────────┐
│ Google          │
│ Senior PM       │
│ $200-250k       │
│ [View] [Edit] [✕]│
└─────────────────┘
```

**Hovering:**
```
┌─────────────────┐ ← shadow increases
│ Google          │ ← scale slightly up
│ Senior PM       │
│ $200-250k       │
│ [View] [Edit] [✕]│
└─────────────────┘
```

**Dragging:**
```
┌─────────────────┐
│ Google          │ ← opacity 50%
│ Senior PM       │ ← cursor: grab
│ $200-250k       │
│ [View] [Edit] [✕]│
└─────────────────┘
```

---

## Component Interactions

### 1. Job Addition Flow
```
User clicks [+ Add Job]
  ↓
Modal opens with form
  ↓
User fills: Title, Company, Location, URL, Salary
  ↓
User clicks "Save Job"
  ↓
Jobs list updates (optimistic update)
  ↓
Toast notification: "Job added successfully!"
```

### 2. Resume Tailoring Flow
```
User inputs resume + JD
  ↓
User clicks "Generate"
  ↓
Loading spinner
  ↓
API calls OpenAI (⏱️ ~5-10 seconds)
  ↓
Results appear (sections animate in)
  ↓
User can copy sections
```

### 3. Kanban Drag & Drop
```
User drags job card
  ↓
Card shows drag state
  ↓
User drops on new stage
  ↓
Card animates to new column
  ↓
API updates stage
  ↓
Timeline event created
```

---

## Responsive Design

### Mobile (< 768px)
- Single column layout
- Full-width cards
- Collapsible sections
- Bottom sheet modals
- Touch-friendly tap targets

### Tablet (768px - 1024px)
- 2 column layout for dashboard
- Compact sidebar
- Smaller cards

### Desktop (> 1024px)
- Full layout as shown
- Sidebar navigation
- Multiple columns
- Hover states enabled

---

## Accessibility (WCAG 2.1 AA)

- ✅ Color contrast >= 4.5:1
- ✅ Focus visible on all interactive elements
- ✅ ARIA labels on buttons
- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ Screen reader support
- ✅ Skip navigation link
- ✅ Form error announcements
