#!/bin/bash
set -e

echo "🚀 Starting Financial Health Calculator..."

# ─── Backend ──────────────────────────────────────────────────────────────────
echo ""
echo "📦 Installing Python backend dependencies..."
cd backend
pip install -r requirements.txt -q
echo "✅ Backend dependencies installed"

# Start backend in background
echo "🐍 Starting FastAPI backend on http://localhost:8000 ..."
PYTHONPATH=.. uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

cd ..

# ─── Frontend ─────────────────────────────────────────────────────────────────
echo ""
echo "📦 Installing Node frontend dependencies..."
cd frontend
npm install -q
echo "✅ Frontend dependencies installed"

echo "⚡ Starting Next.js frontend on http://localhost:3000 ..."
npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  FinHealth India — Company Financial Health Calculator ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Frontend:  http://localhost:3000                    ║"
echo "║  Backend:   http://localhost:8000                    ║"
echo "║  API Docs:  http://localhost:8000/docs               ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" SIGINT
wait
