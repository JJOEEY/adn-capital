import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const path = req.nextUrl.pathname.replace('/api/bridge', '')
  const search = req.nextUrl.search
  const res = await fetch('http://fiinquant:8000' + path + search)
  const data = await res.json()
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const path = req.nextUrl.pathname.replace('/api/bridge', '')
  const body = await req.json()
  const res = await fetch('http://fiinquant:8000' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await res.json()
  return NextResponse.json(data)
}
