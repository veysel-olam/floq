import { test as setup } from '@playwright/test'
import path from 'node:path'

const authFile = path.join(__dirname, '../.auth/mobile.json')
const API_URL = process.env.API_URL ?? 'http://localhost:3001'

setup('authenticate mobile', async ({ context }) => {
  const res = await context.request.post(`${API_URL}/api/auth/sign-in/email`, {
    data: {
      email: process.env.E2E_EMAIL ?? 'test@floq.test',
      password: process.env.E2E_PASSWORD ?? 'password123',
    },
  })

  if (!res.ok()) {
    const body = await res.text()
    throw new Error(`Login failed (${res.status()}): ${body}`)
  }

  await context.storageState({ path: authFile })
})
