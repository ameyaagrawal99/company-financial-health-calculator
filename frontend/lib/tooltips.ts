export interface TooltipData {
  name: string
  formula: string
  plain: string
  signifies: string
  indianContext: string
  healthyRange: string
}

export const TOOLTIPS: Record<string, TooltipData> = {
  gross_margin: {
    name: "Gross Margin %",
    formula: "(Revenue – COGS) / Revenue × 100",
    plain: "What percentage of revenue remains after paying for direct costs of goods sold?",
    signifies: "Low gross margin = pricing pressure or high material costs. Hard to recover at the operating level.",
    indianContext: "Manufacturing SMEs typically target 25–40%. Service businesses often 50%+.",
    healthyRange: "> 30% (manufacturing), > 50% (services)",
  },
  net_profit_margin: {
    name: "Net Profit Margin %",
    formula: "Net Profit / Revenue × 100",
    plain: "Of every ₹100 earned, how many rupees become actual profit after ALL costs?",
    signifies: "The bottom line. Rising margin = efficiency gains. Falling margin = cost creep.",
    indianContext: "Indian SMEs average 4–8%. Tech/pharma companies often 15–25%.",
    healthyRange: "> 10% (healthy), > 5% (acceptable)",
  },
  ebitda_margin: {
    name: "EBITDA Margin %",
    formula: "EBITDA / Revenue × 100",
    plain: "Profit from operations before finance costs and non-cash items. Preferred metric for valuations.",
    signifies: "Banks and PE firms use EBITDA for lending and valuation multiples (EV/EBITDA).",
    indianContext: "EBITDA > 15% is generally considered healthy for most Indian sectors.",
    healthyRange: "> 15% (good), > 8% (acceptable)",
  },
  roe: {
    name: "Return on Equity (ROE) %",
    formula: "Net Profit / Shareholders' Equity × 100",
    plain: "How much profit does the company generate for every ₹100 of shareholders' money?",
    signifies: "High ROE = efficient use of equity capital. Negative ROE = equity erosion.",
    indianContext: "Nifty 500 average ROE is ~15%. Banks require ROE > 12% for preferential lending.",
    healthyRange: "> 15% (good), > 20% (excellent)",
  },
  roa: {
    name: "Return on Assets (ROA) %",
    formula: "Net Profit / Total Assets × 100",
    plain: "How efficiently does the company use its entire asset base to generate profit?",
    signifies: "Low ROA = assets not being used productively (idle plant, excess inventory).",
    indianContext: "Capital-intensive industries (steel, cement) will have lower ROA than IT/FMCG.",
    healthyRange: "> 5% (asset-heavy), > 10% (asset-light)",
  },
  roce: {
    name: "Return on Capital Employed (ROCE) %",
    formula: "EBIT / (Total Assets – Current Liabilities) × 100",
    plain: "Returns on all long-term capital deployed — both debt and equity.",
    signifies: "ROCE > Cost of Capital = value creation. ROCE < Cost of Capital = value destruction.",
    indianContext: "SEBI guidelines reference ROCE for assessing management efficiency.",
    healthyRange: "> 15% (good), must exceed WACC",
  },
  current_ratio: {
    name: "Current Ratio",
    formula: "Current Assets / Current Liabilities",
    plain: "For every ₹1 the company owes in the short term, how many rupees does it have in current assets?",
    signifies: "< 1.0 = cannot meet short-term obligations. > 3.0 = possibly holding too much idle cash.",
    indianContext: "Banks require Current Ratio > 1.33 for working capital loans (CMA norms).",
    healthyRange: "1.33x – 2.5x (banking norm: >1.33x)",
  },
  quick_ratio: {
    name: "Quick Ratio (Acid Test)",
    formula: "(Current Assets – Inventory) / Current Liabilities",
    plain: "Can the company pay all short-term dues without selling inventory?",
    signifies: "More conservative than current ratio. Tests true liquidity without stock.",
    indianContext: "For trading businesses with slow inventory, this is the more critical test.",
    healthyRange: "> 1.0x (ideal), > 0.7x (acceptable)",
  },
  dso: {
    name: "DSO — Days Sales Outstanding",
    formula: "(Trade Receivables ÷ Revenue) × 365",
    plain: "On average, how many days does it take your customers to pay you?",
    signifies: "Rising DSO = cash stuck in debtors, working capital strain, bad debt risk.",
    indianContext: "MSME customers must be paid within 45 days per MSMED Act. You must disclose overdue.",
    healthyRange: "< 45 days (MSME goods), < 60 days (services)",
  },
  dpo: {
    name: "DPO — Days Payable Outstanding",
    formula: "(Trade Payables ÷ COGS) × 365",
    plain: "On average, how many days does the company take to pay its suppliers?",
    signifies: "Very high DPO (>90 days) = stretching suppliers, MSME Act violation risk.",
    indianContext: "MSME suppliers must be paid within 45 days. Overdue = interest at 3x bank rate.",
    healthyRange: "30–60 days (optimal), < 45 days for MSME vendors",
  },
  dio: {
    name: "DIO — Days Inventory Outstanding",
    formula: "(Inventory ÷ COGS) × 365",
    plain: "How many days does inventory sit in the warehouse before being sold?",
    signifies: "High DIO = slow-moving stock, obsolescence risk, capital locked up.",
    indianContext: "GST input credit on inventory can be blocked if vendor non-compliant.",
    healthyRange: "< 45 days (FMCG), < 90 days (manufacturing)",
  },
  debt_to_equity: {
    name: "Debt-to-Equity Ratio",
    formula: "Total Debt / Shareholders' Equity",
    plain: "For every ₹1 of owner's equity, how much has been borrowed from lenders?",
    signifies: "High D/E = high financial risk. Lenders become nervous above 3x.",
    indianContext: "RBI prudential norms for NBFCs: leverage ≤ 7x. Banks typically lend up to 3x D/E for SMEs.",
    healthyRange: "< 1.0x (conservative), < 2.0x (acceptable), < 3.0x (maximum)",
  },
  interest_coverage: {
    name: "Interest Coverage Ratio",
    formula: "EBIT / Finance Costs",
    plain: "How many times can operating profit cover the interest expense?",
    signifies: "< 1.5x = danger zone. Lenders may classify as Special Mention Account (SMA).",
    indianContext: "RBI's SMA-0 classification triggers if dues unpaid for 30 days. ICR < 1 = SMA risk.",
    healthyRange: "> 3.0x (safe), > 1.5x (minimum acceptable)",
  },
  dscr: {
    name: "DSCR — Debt Service Coverage Ratio",
    formula: "Net Operating Income / Total Debt Service (Principal + Interest)",
    plain: "Can the business generate enough cash to repay both principal and interest on all loans?",
    signifies: "< 1.0 = cannot service debt from operations. Highest priority risk for bankers.",
    indianContext: "RBI standard: DSCR > 1.25x required for project finance. Banks use OCF/DSCR for credit rating.",
    healthyRange: "> 1.25x (RBI norm), > 1.5x (comfortable)",
  },
  cash_conversion_cycle: {
    name: "Cash Conversion Cycle (CCC)",
    formula: "DSO + DIO – DPO",
    plain: "How many days does it take to convert investments in inventory into cash from customers?",
    signifies: "High CCC = cash tied up in the operating cycle, more working capital loan needed.",
    indianContext: "Negative CCC (like Flipkart, D-Mart) means suppliers fund your business — ideal model.",
    healthyRange: "< 60 days (good), < 30 days (excellent), negative = best case",
  },
  asset_turnover: {
    name: "Asset Turnover",
    formula: "Revenue / Total Assets",
    plain: "How much revenue is generated for every ₹1 of total assets?",
    signifies: "Low = underutilized assets or low capacity utilization.",
    indianContext: "Capital-intensive sectors (steel, real estate): 0.3–0.8x. FMCG/IT: 1–3x.",
    healthyRange: "> 1.0x (asset-light), > 0.5x (asset-heavy industries)",
  },
  net_profit_margin_simple: {
    name: "Net Profit Margin",
    formula: "Net Profit / Revenue × 100",
    plain: "Bottom-line profitability ratio.",
    signifies: "Core profitability indicator.",
    indianContext: "Indian SME average: 4–8%",
    healthyRange: "> 10%",
  },
}

export function getTooltip(key: string): TooltipData | null {
  return TOOLTIPS[key] || null
}
