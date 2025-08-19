interface HuggingFaceModel {
  id: string
  author: string
  sha: string
  lastModified: string
  private: boolean
  disabled: boolean
  gated: boolean | string
  downloads: number
  likes: number
  library_name?: string
  tags: string[]
  pipeline_tag?: string
  mask_token?: string
  card_data?: {
    language?: string[]
    license?: string
    datasets?: string[]
    metrics?: string[]
    model_name?: string
    base_model?: string
    inference?: boolean
    widget?: any[]
  }
  siblings: HuggingFaceFile[]
  spaces?: string[]
  safetensors?: {
    parameters: Record<string, number>
    total: number
  }
}

interface HuggingFaceFile {
  rfilename: string
  size?: number
  blob_id?: string
  lfs?: {
    size: number
    sha256: string
    pointer_size: number
  }
}

interface HuggingFaceSearchParams {
  search?: string
  author?: string
  filter?: string
  sort?: 'downloads' | 'likes' | 'trending' | 'lastModified'
  direction?: 'asc' | 'desc'
  limit?: number
  page?: number
  full?: boolean
  config?: boolean
}

interface HuggingFaceSearchResponse {
  models: HuggingFaceModel[]
  numItemsOnPage: number
  numTotalItems: number
  pageIndex: number
}

interface HuggingFaceModelInfo {
  id: string
  sha: string
  lastModified: string
  tags: string[]
  pipeline_tag?: string
  library_name?: string
  mask_token?: string
  widget_data?: any[]
  model_index?: any
  config?: any
  tokenizer_config?: any
  card_data?: any
  siblings: HuggingFaceFile[]
  spaces: string[]
  downloads: number
  likes: number
  private: boolean
  gated: boolean | string
  disabled: boolean
  author: string
  safetensors?: {
    parameters: Record<string, number>
    total: number
  }
}

interface HuggingFaceModelCard {
  content: string
  metadata: Record<string, any>
}

interface HuggingFaceDownloadInfo {
  downloadUrl: string
  filename: string
  size: number
  sha256?: string
  requiresAuth: boolean
}

class HuggingFaceRateLimiter {
  private requests: number[] = []
  private readonly maxRequests: number
  private readonly timeWindow: number

  constructor(maxRequests: number = 1000, timeWindowMs: number = 3600000) { // 1000 requests per hour
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

export class HuggingFaceClient {
  private baseUrl = 'https://huggingface.co/api'
  private apiKey?: string
  private rateLimiter: HuggingFaceRateLimiter

  constructor(apiKey?: string) {
    this.apiKey = apiKey
    this.rateLimiter = new HuggingFaceRateLimiter()
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
      'User-Agent': 'ComfyUI-Deployment-Builder/1.0'
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    try {
      const response = await fetch(url.toString(), {
        headers,
        method: 'GET'
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HuggingFace API error (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`HuggingFace API request failed: ${error.message}`)
      }
      throw new Error('HuggingFace API request failed: Unknown error')
    }
  }

  async searchModels(params: HuggingFaceSearchParams = {}): Promise<HuggingFaceModel[]> {
    const searchParams: Record<string, any> = {
      search: params.search,
      author: params.author,
      filter: params.filter,
      limit: params.limit || 20,
      skip: params.page ? (params.page - 1) * (params.limit || 20) : 0, // Calculate offset for pagination
      full: params.full !== false, // Default to true
      config: params.config !== false // Default to true
    }

    // Handle HuggingFace API sort parameter requirements
    if (params.sort) {
      if (params.sort === 'downloads') {
        searchParams.sort = 'downloads'
        // HuggingFace only supports descending for downloads
        searchParams.direction = -1
      } else if (params.sort === 'likes') {
        searchParams.sort = 'likes'
        searchParams.direction = (params.direction === 'asc') ? 1 : -1
      } else if (params.sort === 'trending') {
        searchParams.sort = 'trending'
        // No direction for trending
      } else if (params.sort === 'lastModified') {
        searchParams.sort = 'lastModified'
        searchParams.direction = (params.direction === 'asc') ? 1 : -1
      } else {
        // Default to downloads if unsupported sort
        searchParams.sort = 'downloads'
        searchParams.direction = -1
      }
    } else {
      searchParams.sort = 'downloads'
      searchParams.direction = -1
    }

    return this.makeRequest<HuggingFaceModel[]>('/models', searchParams)
  }

  async getModel(modelId: string): Promise<HuggingFaceModelInfo> {
    return this.makeRequest<HuggingFaceModelInfo>(`/models/${modelId}`)
  }

  async getModelCard(modelId: string): Promise<HuggingFaceModelCard> {
    try {
      const response = await fetch(`https://huggingface.co/${modelId}/raw/main/README.md`)
      if (!response.ok) {
        throw new Error(`Failed to fetch model card: ${response.status}`)
      }
      
      const content = await response.text()
      
      // Extract YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
      let metadata = {}
      
      if (frontmatterMatch) {
        try {
          // Simple YAML parsing for basic metadata
          const yamlContent = frontmatterMatch[1]
          const lines = yamlContent.split('\n')
          
          for (const line of lines) {
            const match = line.match(/^([^:]+):\s*(.+)$/)
            if (match) {
              const [, key, value] = match
              try {
                metadata[key.trim()] = JSON.parse(value.trim())
              } catch {
                metadata[key.trim()] = value.trim()
              }
            }
          }
        } catch (error) {
          console.warn('Failed to parse YAML frontmatter:', error)
        }
      }
      
      return {
        content,
        metadata
      }
    } catch (error) {
      throw new Error(`Failed to fetch model card: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getModelFiles(modelId: string): Promise<HuggingFaceFile[]> {
    const model = await this.getModel(modelId)
    return model.siblings
  }

  async getDownloadInfo(modelId: string, filename: string): Promise<HuggingFaceDownloadInfo> {
    const files = await this.getModelFiles(modelId)
    const file = files.find(f => f.rfilename === filename)
    
    if (!file) {
      throw new Error(`File ${filename} not found in model ${modelId}`)
    }

    const downloadUrl = `https://huggingface.co/${modelId}/resolve/main/${filename}`
    
    return {
      downloadUrl,
      filename: file.rfilename,
      size: file.size || file.lfs?.size || 0,
      sha256: file.lfs?.sha256,
      requiresAuth: false // Most HF models don't require auth for download
    }
  }

  // Helper methods for specific model types
  async searchDiffusionModels(query?: string): Promise<HuggingFaceModel[]> {
    return this.searchModels({
      search: query,
      filter: 'diffusers',
      sort: 'downloads'
    })
  }

  async searchTransformersModels(query?: string, task?: string): Promise<HuggingFaceModel[]> {
    const filter = task ? `transformers,${task}` : 'transformers'
    return this.searchModels({
      search: query,
      filter,
      sort: 'downloads'
    })
  }

  async searchByLibrary(library: string, query?: string): Promise<HuggingFaceModel[]> {
    return this.searchModels({
      search: query,
      filter: library,
      sort: 'downloads'
    })
  }

  async getTrendingModels(limit: number = 20): Promise<HuggingFaceModel[]> {
    return this.searchModels({
      sort: 'trending',
      limit
    })
  }

  async getModelsByAuthor(author: string, limit: number = 20): Promise<HuggingFaceModel[]> {
    return this.searchModels({
      author,
      limit,
      sort: 'downloads'
    })
  }

  // Utility methods
  isStableDiffusionModel(model: HuggingFaceModel): boolean {
    const tags = model.tags.map(tag => tag.toLowerCase())
    return tags.includes('stable-diffusion') || 
           tags.includes('diffusion') ||
           tags.includes('text-to-image') ||
           model.pipeline_tag === 'text-to-image' ||
           model.library_name === 'diffusers'
  }

  getModelType(model: HuggingFaceModel): string {
    if (this.isStableDiffusionModel(model)) {
      if (model.tags.some(tag => tag.toLowerCase().includes('lora'))) {
        return 'LORA'
      }
      if (model.tags.some(tag => tag.toLowerCase().includes('controlnet'))) {
        return 'CONTROLNET'
      }
      if (model.tags.some(tag => tag.toLowerCase().includes('vae'))) {
        return 'VAE'
      }
      return 'CHECKPOINT'
    }
    
    if (model.pipeline_tag === 'text-to-image') return 'CHECKPOINT'
    if (model.pipeline_tag === 'image-to-image') return 'OTHER'
    if (model.library_name === 'transformers') return 'OTHER'
    
    return 'OTHER'
  }

  getBaseModel(model: HuggingFaceModel): string | null {
    const tags = model.tags.map(tag => tag.toLowerCase())
    
    if (tags.includes('sd-1-5') || tags.includes('stable-diffusion-1-5')) return 'SD 1.5'
    if (tags.includes('sdxl') || tags.includes('stable-diffusion-xl')) return 'SDXL 1.0'
    if (tags.includes('sd-2-1') || tags.includes('stable-diffusion-2-1')) return 'SD 2.1'
    if (tags.includes('sd3') || tags.includes('stable-diffusion-3')) return 'SD 3.0'
    
    // Check card data
    if (model.card_data?.base_model) {
      return model.card_data.base_model
    }
    
    return null
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return 'Unknown'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  getPrimaryModelFile(model: HuggingFaceModel): HuggingFaceFile | null {
    // Look for common model file extensions
    const modelExtensions = ['.safetensors', '.bin', '.ckpt', '.pt', '.pth']
    
    for (const ext of modelExtensions) {
      const file = model.siblings.find(f => f.rfilename.endsWith(ext) && !f.rfilename.includes('/'))
      if (file) return file
    }
    
    // Fallback to first non-config file
    return model.siblings.find(f => 
      !f.rfilename.includes('config') && 
      !f.rfilename.includes('tokenizer') &&
      !f.rfilename.includes('.json') &&
      !f.rfilename.includes('.txt') &&
      !f.rfilename.includes('README')
    ) || null
  }

  getModelLicense(model: HuggingFaceModel): string {
    return model.card_data?.license || 'Unknown'
  }

  isCommercialUseAllowed(model: HuggingFaceModel): boolean {
    const license = this.getModelLicense(model).toLowerCase()
    const commercialLicenses = [
      'apache-2.0',
      'mit',
      'bsd',
      'cc-by-4.0',
      'openrail',
      'creativeml-openrail-m'
    ]
    
    return commercialLicenses.some(cl => license.includes(cl))
  }
}

// Create singleton instance - will be updated with dynamic token
export const huggingfaceClient = new HuggingFaceClient(process.env.HUGGINGFACE_API_KEY)

// Factory function to create client with dynamic token from database
export async function createHuggingFaceClient(): Promise<HuggingFaceClient> {
  try {
    const { getApiToken } = await import('@/lib/token-service')
    const token = await getApiToken('HUGGINGFACE')
    return new HuggingFaceClient(token)
  } catch (error) {
    console.warn('Failed to get HuggingFace token from database, using environment variable')
    return new HuggingFaceClient(process.env.HUGGINGFACE_API_KEY)
  }
}

// Export types for use in other files
export type {
  HuggingFaceModel,
  HuggingFaceFile,
  HuggingFaceSearchParams,
  HuggingFaceSearchResponse,
  HuggingFaceModelInfo,
  HuggingFaceModelCard,
  HuggingFaceDownloadInfo
}