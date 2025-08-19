import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import crypto from 'crypto'

interface SettingsData {
  // API Tokens
  civitaiToken?: string
  huggingfaceToken?: string
  
  // System Settings (stored as JSON in a single record for now)
  maxUploadSize?: string
  defaultTimeout?: string
  enableMetrics?: boolean
  enableLogging?: boolean
  
  // Security Settings
  enableRateLimit?: boolean
  maxRequestsPerMinute?: string
  enableCors?: boolean
  allowedOrigins?: string
  
  // Notification Settings
  emailNotifications?: boolean
  slackWebhook?: string
  discordWebhook?: string
}

// Encrypt sensitive data
function encrypt(text: string): string {
  const algorithm = 'aes-256-cbc'
  const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-change-in-production-please').slice(0, 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

// Decrypt sensitive data
function decrypt(encryptedText: string): string {
  try {
    const algorithm = 'aes-256-cbc'
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-change-in-production-please').slice(0, 32)
    const parts = encryptedText.split(':')
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    console.warn('Failed to decrypt token, returning empty string')
    return ''
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure the user exists in the database
    let dbUser = await db.user.findUnique({
      where: { id: session.user.id }
    })
    
    if (!dbUser) {
      // Create the user if it doesn't exist (for JWT sessions)
      dbUser = await db.user.create({
        data: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name || session.user.email.split('@')[0],
          role: session.user.role || 'ADMIN'
        }
      })
    }

    // Get API tokens from database
    const tokens = await db.apiToken.findMany({
      where: {
        userId: session.user.id,
        isActive: true
      }
    })

    // Create a map of service -> token
    const tokenMap: Record<string, string> = {}
    tokens.forEach(token => {
      try {
        tokenMap[token.service.toLowerCase()] = decrypt(token.token)
      } catch (error) {
        console.warn(`Failed to decrypt token for service ${token.service}`)
        tokenMap[token.service.toLowerCase()] = ''
      }
    })

    // TODO: Get system settings from a dedicated settings table
    // For now, return defaults
    const settings: SettingsData = {
      // API Tokens
      civitaiToken: tokenMap.civitai || '',
      huggingfaceToken: tokenMap.huggingface || '',
      
      // System Settings - defaults
      maxUploadSize: '10',
      defaultTimeout: '30',
      enableMetrics: true,
      enableLogging: true,
      
      // Security Settings - defaults
      enableRateLimit: true,
      maxRequestsPerMinute: '100',
      enableCors: true,
      allowedOrigins: 'http://localhost:3000',
      
      // Notification Settings - defaults
      emailNotifications: true,
      slackWebhook: '',
      discordWebhook: ''
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings: SettingsData = await request.json()

    // Ensure the user exists in the database
    let dbUser = await db.user.findUnique({
      where: { id: session.user.id }
    })
    
    if (!dbUser) {
      // Create the user if it doesn't exist (for JWT sessions)
      dbUser = await db.user.create({
        data: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name || session.user.email.split('@')[0],
          role: session.user.role || 'ADMIN'
        }
      })
    }

    // Save API tokens to database
    const tokenServices = [
      { service: 'CIVITAI', token: settings.civitaiToken, name: 'CivitAI API Token' },
      { service: 'HUGGINGFACE', token: settings.huggingfaceToken, name: 'HuggingFace API Token' }
    ]

    for (const { service, token, name } of tokenServices) {
      if (token) {
        // Check if token already exists
        const existingToken = await db.apiToken.findFirst({
          where: {
            userId: session.user.id,
            service: service as any
          }
        })

        if (existingToken) {
          // Update existing token
          await db.apiToken.update({
            where: { id: existingToken.id },
            data: {
              token: encrypt(token),
              lastUsed: null,
              isActive: true
            }
          })
        } else {
          // Create new token
          await db.apiToken.create({
            data: {
              name,
              service: service as any,
              token: encrypt(token),
              userId: session.user.id,
              isActive: true
            }
          })
        }
      } else {
        // If token is empty, deactivate existing token
        await db.apiToken.updateMany({
          where: {
            userId: session.user.id,
            service: service as any
          },
          data: {
            isActive: false
          }
        })
      }
    }

    // TODO: Save other settings to a dedicated settings table
    // For now, we'll just acknowledge the save

    return NextResponse.json({ message: 'Settings saved successfully' })
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Test API token endpoint
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { service, token } = await request.json()

    console.log(`Testing ${service} token...`)

    if (!service || !token) {
      return NextResponse.json({ error: 'Service and token are required' }, { status: 400 })
    }

    // Test the token based on service
    let testResult = { success: false, message: 'Unknown service' }

    if (service.toLowerCase() === 'huggingface') {
      try {
        console.log(`Testing HuggingFace token: ${token.substring(0, 10)}...`)
        
        const response = await fetch('https://huggingface.co/api/whoami', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'ComfyUI-Deployment-Builder/1.0',
            'Content-Type': 'application/json'
          }
        })
        
        console.log(`HuggingFace API response status: ${response.status}`)
        console.log(`HuggingFace API response headers:`, Object.fromEntries(response.headers.entries()))
        
        if (response.ok) {
          const data = await response.json()
          console.log('HuggingFace API response data:', data)
          testResult = {
            success: true,
            message: `✅ Connected as ${data.name || data.username || data.login || 'user'}`
          }
        } else {
          const errorText = await response.text()
          console.log(`HuggingFace API error: ${response.status} - ${errorText}`)
          
          // Try alternative endpoint if whoami fails
          console.log('Trying alternative HuggingFace API endpoint...')
          const altResponse = await fetch('https://huggingface.co/api/models?limit=1', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'User-Agent': 'ComfyUI-Deployment-Builder/1.0'
            }
          })
          
          console.log(`Alternative API response status: ${altResponse.status}`)
          
          if (altResponse.ok) {
            testResult = {
              success: true,
              message: `✅ HuggingFace API connection verified - token is valid`
            }
          } else {
            const altErrorText = await altResponse.text()
            console.log(`Alternative API also failed: ${altResponse.status} - ${altErrorText}`)
            testResult = {
              success: false,
              message: `❌ Authentication failed on both endpoints (${response.status}): ${errorText}`
            }
          }
        }
      } catch (error) {
        console.error('HuggingFace test error:', error)
        testResult = {
          success: false,
          message: `❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    } else if (service.toLowerCase() === 'civitai') {
      try {
        const response = await fetch('https://civitai.com/api/v1/models?limit=1', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'ComfyUI-Deployment-Builder/1.0'
          }
        })
        
        if (response.ok) {
          testResult = {
            success: true,
            message: '✅ CivitAI API connection successful'
          }
        } else {
          testResult = {
            success: false,
            message: `❌ CivitAI API failed (${response.status})`
          }
        }
      } catch (error) {
        testResult = {
          success: false,
          message: `❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    }

    return NextResponse.json(testResult)
  } catch (error) {
    console.error('Error testing API token:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}