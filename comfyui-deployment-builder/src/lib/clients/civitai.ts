interface CivitAIModel {
  id: number
  name: string
  description: string
  type: string
  poi: boolean
  nsfw: boolean
  allowNoCredit: boolean
  allowCommercialUse: string[]
  allowDerivatives: boolean
  allowDifferentLicense: boolean
  stats: {
    downloadCount: number
    favoriteCount: number
    commentCount: number
    ratingCount: number
    rating: number
  }
  creator: {
    username: string
    image?: string
  }
  tags: string[]
  modelVersions: CivitAIModelVersion[]
}

interface CivitAIModelVersion {
  id: number
  name: string
  description: string
  baseModel: string
  files: CivitAIFile[]
  images: CivitAIImage[]
  downloadUrl: string
  stats: {
    downloadCount: number
    ratingCount: number
    rating: number
  }
  trainedWords?: string[]
  createdAt: string
  updatedAt: string
}

interface CivitAIFile {
  id: number
  url: string
  sizeKB: number
  name: string
  type: string
  format: string
  pickleScanResult: string
  pickleScanMessage?: string
  virusScanResult: string
  virusScanMessage?: string
  scannedAt?: string
  hashes: {
    AutoV1?: string
    AutoV2?: string
    SHA256?: string
    CRC32?: string
    BLAKE3?: string
  }
  downloadUrl: string
  primary: boolean
}

interface CivitAIImage {
  id: number
  url: string
  nsfw: string
  width: number
  height: number
  hash: string
  type: string
  meta?: {
    prompt?: string
    negativePrompt?: string
    seed?: number
    steps?: number
    sampler?: string
    cfgScale?: number
    model?: string
  }
}

interface CivitAISearchParams {
  limit?: number
  page?: number
  cursor?: string
  query?: string
  tag?: string
  username?: string
  types?: string[]
  sort?: 'Highest Rated' | 'Most Downloaded' | 'Newest' | 'Most Liked' | 'Most Discussed'
  period?: 'AllTime' | 'Year' | 'Month' | 'Week' | 'Day'
  rating?: number
  favorites?: boolean
  hidden?: boolean
  primaryFileOnly?: boolean
  allowNoCredit?: boolean
  allowDerivatives?: boolean
  allowDifferentLicenses?: boolean
  allowCommercialUse?: string[]
  nsfw?: boolean
  supportsGeneration?: boolean
  baseModels?: string[]
}

interface CivitAISearchResponse {
  items: CivitAIModel[]
  metadata: {
    totalItems: number
    currentPage: number
    pageSize: number
    totalPages: number
    nextPage?: string
    prevPage?: string
  }
}

class RateLimiter {
  private requests: number[] = []
  private readonly maxRequests: number
  private readonly timeWindow: number

  constructor(maxRequests: number = 100, timeWindowMs: number = 60000) {
    this.maxRequests = maxRequests
    this.timeWindow = timeWindowMs
  }

  async checkRateLimit(): Promise<void> {
    const now = Date.now()
    
    // Remove requests outside the time window
    this.requests = this.requests.filter(time => now - time < this.timeWindow)
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests)
      const waitTime = this.timeWindow - (now - oldestRequest)
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return this.checkRateLimit()
      }
    }
    
    this.requests.push(now)
  }
}

export class CivitAIClient {
  private baseUrl = 'https://civitai.com/api/v1'
  private apiKey?: string
  private rateLimiter: RateLimiter

  constructor(apiKey?: string) {
    this.apiKey = apiKey
    this.rateLimiter = new RateLimiter(100, 60000) // 100 requests per minute
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    await this.rateLimiter.checkRateLimit()

    const url = new URL(`${this.baseUrl}${endpoint}`)
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => url.searchParams.append(key, v.toString()))
          } else {
            url.searchParams.append(key, value.toString())
          }
        }
      })
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ComfyUI-Deployment-Builder/1.0'
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    try {
      console.log('CivitAI API Request:', {
        url: url.toString(),
        headers: { ...headers, Authorization: this.apiKey ? '[REDACTED]' : 'none' }
      })
      
      const response = await fetch(url.toString(), {
        headers,
        method: 'GET'
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('CivitAI API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
        throw new Error(`CivitAI API error (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      console.log('CivitAI API Response:', {
        itemsCount: data.items?.length || 0,
        metadata: data.metadata
      })
      return data
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`CivitAI API request failed: ${error.message}`)
      }
      throw new Error('CivitAI API request failed: Unknown error')
    }
  }

  async searchModels(params: CivitAISearchParams = {}): Promise<CivitAISearchResponse> {
    const searchParams: any = {
      limit: params.limit || 100,
      query: params.query,
      cursor: params.cursor,
      tag: params.tag,
      username: params.username,
      types: params.types,
      sort: params.sort || 'Highest Rated',
      period: params.period || 'AllTime',
      rating: params.rating,
      favorites: params.favorites,
      hidden: params.hidden,
      primaryFileOnly: params.primaryFileOnly,
      allowNoCredit: params.allowNoCredit,
      allowDerivatives: params.allowDerivatives,
      allowDifferentLicenses: params.allowDifferentLicenses,
      allowCommercialUse: params.allowCommercialUse,
      nsfw: params.nsfw,
      supportsGeneration: params.supportsGeneration,
      baseModels: params.baseModels
    }

    // CivitAI cursor-based pagination logic
    if (params.cursor) {
      // If cursor is provided, don't use page parameter (cursor takes precedence)
      searchParams.cursor = params.cursor
    } else if (!params.query?.trim()) {
      // If no cursor and no query, use traditional page-based pagination
      searchParams.page = params.page || 1
    }
    // If query is provided but no cursor, CivitAI will use cursor-based pagination automatically

    return this.makeRequest<CivitAISearchResponse>('/models', searchParams)
  }

  async getModel(modelId: number): Promise<CivitAIModel> {
    return this.makeRequest<CivitAIModel>(`/models/${modelId}`)
  }

  async getModelVersion(versionId: number): Promise<CivitAIModelVersion> {
    return this.makeRequest<CivitAIModelVersion>(`/model-versions/${versionId}`)
  }

  async getModelVersions(modelId: number): Promise<{ items: CivitAIModelVersion[] }> {
    return this.makeRequest<{ items: CivitAIModelVersion[] }>(`/models/${modelId}/versions`)
  }

  async getTags(): Promise<{ items: Array<{ name: string; modelCount: number; link: string }> }> {
    return this.makeRequest('/tags')
  }

  // Helper methods for common operations
  async searchCheckpoints(query?: string, baseModel?: string): Promise<CivitAISearchResponse> {
    return this.searchModels({
      query,
      types: ['Checkpoint'],
      baseModels: baseModel ? [baseModel] : undefined,
      sort: 'Highest Rated'
    })
  }

  async searchLORAs(query?: string, baseModel?: string): Promise<CivitAISearchResponse> {
    return this.searchModels({
      query,
      types: ['LORA'],
      baseModels: baseModel ? [baseModel] : undefined,
      sort: 'Highest Rated'
    })
  }

  async searchControlNets(query?: string): Promise<CivitAISearchResponse> {
    return this.searchModels({
      query,
      types: ['ControlNet'],
      sort: 'Highest Rated'
    })
  }

  async getPopularModels(type?: string, period: 'AllTime' | 'Month' | 'Week' = 'Month'): Promise<CivitAISearchResponse> {
    return this.searchModels({
      types: type ? [type] : undefined,
      sort: 'Most Downloaded',
      period,
      limit: 50
    })
  }

  // Utility methods
  formatFileSize(sizeKB: number): string {
    if (sizeKB < 1024) {
      return `${sizeKB} KB`
    } else if (sizeKB < 1024 * 1024) {
      return `${(sizeKB / 1024).toFixed(2)} MB`
    } else {
      return `${(sizeKB / (1024 * 1024)).toFixed(2)} GB`
    }
  }

  isModelSafe(model: CivitAIModel): boolean {
    return !model.nsfw && !model.poi
  }

  getModelThumbnail(model: CivitAIModel): string | null {
    const version = model.modelVersions[0]
    if (version?.images && version.images.length > 0) {
      const safeImage = version.images.find(img => img.nsfw === 'None')
      return safeImage?.url || version.images[0].url
    }
    return null
  }

  getPrimaryFile(version: CivitAIModelVersion): CivitAIFile | null {
    return version.files.find(file => file.primary) || version.files[0] || null
  }
}

// Create singleton instance - will be updated with dynamic token
export const civitaiClient = new CivitAIClient(process.env.CIVITAI_API_KEY)

// Factory function to create client with dynamic token from database
export async function createCivitAIClient(): Promise<CivitAIClient> {
  try {
    const { getApiToken } = await import('@/lib/token-service')
    const token = await getApiToken('CIVITAI')
    return new CivitAIClient(token)
  } catch (error) {
    console.warn('Failed to get CivitAI token from database, using environment variable')
    return new CivitAIClient(process.env.CIVITAI_API_KEY)
  }
}

// Export types for use in other files
export type {
  CivitAIModel,
  CivitAIModelVersion,
  CivitAIFile,
  CivitAIImage,
  CivitAISearchParams,
  CivitAISearchResponse
}