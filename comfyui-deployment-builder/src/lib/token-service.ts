import { db } from '@/lib/db'
import crypto from 'crypto'

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

/**
 * Get API token for a specific service for any admin user
 * Fallback to environment variable if not found in database
 */
export async function getApiToken(service: 'CIVITAI' | 'HUGGINGFACE'): Promise<string | undefined> {
  try {
    // Look for any active token for this service from any admin user
    const apiToken = await db.apiToken.findFirst({
      where: {
        service: service,
        isActive: true,
        user: {
          role: 'ADMIN'
        }
      },
      include: {
        user: true
      }
    })

    if (apiToken) {
      const decryptedToken = decrypt(apiToken.token)
      if (decryptedToken) {
        // Update last used timestamp
        await db.apiToken.update({
          where: { id: apiToken.id },
          data: { lastUsed: new Date() }
        }).catch(() => {
          // Ignore update errors
        })
        
        return decryptedToken
      }
    }

    console.warn(`No ${service} token found for any admin user, falling back to environment variables`)
    return getEnvironmentToken(service)
  } catch (error) {
    console.warn(`Failed to get ${service} token from database, falling back to environment variable:`, error)
    return getEnvironmentToken(service)
  }
}


function getEnvironmentToken(service: 'CIVITAI' | 'HUGGINGFACE'): string | undefined {
  switch (service) {
    case 'CIVITAI':
      return process.env.CIVITAI_API_KEY
    case 'HUGGINGFACE':
      return process.env.HUGGINGFACE_API_KEY
    default:
      return undefined
  }
}

/**
 * Get all API tokens for the first admin user
 */
export async function getAllApiTokens(): Promise<Record<string, string>> {
  try {
    const adminUser = await db.user.findFirst({
      where: {
        role: 'ADMIN'
      }
    })

    if (!adminUser) {
      return {}
    }

    const tokens = await db.apiToken.findMany({
      where: {
        userId: adminUser.id,
        isActive: true
      }
    })

    const tokenMap: Record<string, string> = {}
    
    for (const token of tokens) {
      try {
        const decryptedToken = decrypt(token.token)
        if (decryptedToken) {
          tokenMap[token.service.toLowerCase()] = decryptedToken
        }
      } catch (error) {
        console.warn(`Failed to decrypt token for service ${token.service}`)
      }
    }

    return tokenMap
  } catch (error) {
    console.warn('Failed to get API tokens from database:', error)
    return {}
  }
}