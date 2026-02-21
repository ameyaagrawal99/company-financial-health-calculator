# 🏥 Company Financial Health Calculator
### India's First SME Financial Intelligence Platform

> Upload your Balance Sheet, P&L, or Cash Flow statement → Get 50+ ratios, a 0–100 health score, GST/TDS/MSME compliance checks, GPT-4o AI analysis, and a fully-formula Excel export — **in under 60 seconds.**

---

## 🚀 One-Click Deploy

### Step 1 — Deploy Backend to Render (Free)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ameyaagrawal99/company-financial-health-calculator)

1. Click the button above
2. In Render dashboard, set Environment Variable: `OPENAI_API_KEY = sk-...your-key...`
3. Your backend URL will be: `https://finhealth-api.onrender.com`

### Step 2 — Deploy Frontend to Vercel (Free)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ameyaagrawal99/company-financial-health-calculator&root=frontend&env=NEXT_PUBLIC_API_URL&envDescription=URL%20of%20your%20Render%20backend%20(e.g.%20https://finhealth-api.onrender.com))

1. Click the button above
2. Set `NEXT_PUBLIC_API_URL` = your Render backend URL from Step 1
3. Deploy! Your app will be live at `https://your-project.vercel.app`

---

## 📁 Sample Files to Test
Download from `/sample_data/` folder:
- **`Sample_Balance_Sheet_Sharma_Textiles_FY2024.xlsx`** — Balance Sheet
- **`Sample_ProfitLoss_Sharma_Textiles_FY2024.xlsx`** — P&L Statement
- **`Sample_CashFlow_Sharma_Textiles_FY2024.xlsx`** — Cash Flow Statement
- **`Sample_Complete_Financials_Sharma_Textiles_FY2024.xlsx`** — All 3 in one workbook

---

## ✨ Features

| Feature | Details |
|---------|---------|
| 📊 **50+ Financial Ratios** | Profitability, Liquidity, Leverage, Efficiency, Cash Flow |
| 🏥 **Health Score 0–100** | Weighted score across 6 categories |
| 🤖 **AI Analysis (GPT-4o)** | CFO-grade narrative, red flags, 90-day action plan |
| 📋 **Indian Compliance** | GST, TDS, PF/ESI, MSME 45-day rule, IBC ₹1Cr risk, ROC |
| 📥 **File Upload** | Auto-parses `.xlsx`, `.xls`, `.csv` financial statements |
| 📤 **Excel Export** | 6-sheet workbook with live formulas, color coding, named ranges |
| 🇮🇳 **India-First** | Schedule III format, Ind AS, ₹ Lakhs/Crores, Indian norms |

---

## 🛠️ Local Development

```bash
# Clone
git clone https://github.com/ameyaagrawal99/company-financial-health-calculator.git
cd company-financial-health-calculator

# Backend
cd backend
pip install -r requirements.txt
PYTHONPATH=.. uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

Or use the convenience script:
```bash
chmod +x start-dev.sh && ./start-dev.sh
```

---

## 🤖 AI Analysis Setup
The AI analysis uses **GPT-4o** via your own OpenAI API key:
1. Get a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Either:
   - Enter it in the dashboard's "AI Analysis" panel (stored only in your browser)
   - Or set `OPENAI_API_KEY` as an environment variable on the backend

**Cost:** ~₹5–15 per analysis (3,000 tokens @ GPT-4o rates)

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 + TypeScript + Tailwind)       │
│  Vercel — https://finhealth.vercel.app               │
└────────────────────┬────────────────────────────────┘
                     │ HTTP / REST
┌────────────────────▼────────────────────────────────┐
│  Backend (FastAPI + Python 3.11)                     │
│  Render — https://finhealth-api.onrender.com         │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐  │
│  │Calculator│ │ Scorer   │ │Complian.│ │  AI    │  │
│  │50+ ratios│ │0-100 scor│ │GST,TDS.│ │GPT-4o  │  │
│  └──────────┘ └──────────┘ └─────────┘ └────────┘  │
│  ┌──────────┐ ┌──────────┐                          │
│  │  Parser  │ │ Exporter │                          │
│  │xlsx/csv  │ │6-sheet xl│                          │
│  └──────────┘ └──────────┘                          │
└─────────────────────────────────────────────────────┘
```

---

## 📊 Health Score Weights

| Category | Weight | Ratios Included |
|----------|--------|----------------|
| Profitability | 25% | NPM, EBITDA, ROE, ROA, ROCE |
| Liquidity | 20% | Current, Quick, Cash ratio, Working Capital |
| Leverage | 20% | D/E, Interest Coverage, DSCR, Net Debt/EBITDA |
| Efficiency | 15% | DSO, DPO, DIO, CCC, Asset Turnover |
| Cash Flow | 10% | OCF, FCF, DSCR, CF Margin |
| Compliance | 10% | GST, TDS, PF/ESI, MSME, IBC |

---

*Built for Indian SMEs, CAs, CFOs, and lenders. India's first open-source financial health platform.*
