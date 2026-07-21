import { MOCK_NOW } from "@/lib/mocks/time"

export function now(): Date {
  return new Date(MOCK_NOW)
}

export function nowIso(): string {
  return now().toISOString()
}
