/**
 * ComfyUI Registry Client
 * 
 * Client for interacting with the ComfyUI Registry API to discover and install custom nodes
 * Base URL: https://api.comfy.org
 */

interface ComfyUIRegistryNode {
  id: string
  name: string
  category?: string
  description?: string
  author?: string
  repository?: string
  tags?: string[]
  publisher?: {
    name: string
    avatar?: string
  }
  status?: string
  latest_version?: {
    id: string
    version: string
    description?: string
    created_at: string
  }
  created_at: string
  updated_at: string
}

interface ComfyUIRegistrySearchParams {
  page?: number
  limit?: number
  search?: string
  include_banned?: boolean
}

interface ComfyUIRegistryListParams {
  page?: number
  limit?: number
  include_banned?: boolean
  timestamp?: string
  latest?: boolean
}

interface ComfyUIRegistrySearchResponse {
  nodes: ComfyUIRegistryNode[]
  total: number
  page: number
  limit: number
  has_more: boolean
}

interface ComfyUIRegistryNodeVersion {
  id: string
  version: string
  description?: string
  changelog?: string
  files: {
    name: string
    url: string
    size: number
    hash?: string
  }[]
  dependencies?: {
    pip_packages?: string[]
    node_dependencies?: string[]
  }
  created_at: string
}

interface ComfyUIRegistryInstallData {
  node_id: string
  name: string
  repository: string
  branch?: string
  install_type: string
  files?: {
    name: string
    content: string
  }[]
  dependencies?: {
    pip_packages?: string[]
    node_dependencies?: string[]
  }
}

class RateLimiter {
  private requests: number[] = []
  private readonly maxRequests: number
  private readonly timeWindow: number

  constructor(maxRequests: number = 60, timeWindowMs: number = 60000) {
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

export class ComfyUIRegistryClient {
  private baseUrl = 'https://api.comfy.org'
  private apiKey?: string
  private rateLimiter: RateLimiter

  constructor(apiKey?: string) {
    this.apiKey = apiKey
    this.rateLimiter = new RateLimiter(60, 60000) // 60 requests per minute
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
      console.log('ComfyUI Registry API Request:', {
        url: url.toString(),
        headers: { ...headers, Authorization: this.apiKey ? '[REDACTED]' : 'none' }
      })
      
      const response = await fetch(url.toString(), {
        headers,
        method: 'GET'
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('ComfyUI Registry API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
        throw new Error(`ComfyUI Registry API error (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      console.log('ComfyUI Registry API Response:', {
        itemsCount: data.nodes?.length || data.versions?.length || 0,
        total: data.total
      })
      return data
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`ComfyUI Registry API request failed: ${error.message}`)
      }
      throw new Error('ComfyUI Registry API request failed: Unknown error')
    }
  }

  /**
   * Search for nodes in the ComfyUI Registry
   */
  async searchNodes(params: ComfyUIRegistrySearchParams = {}): Promise<ComfyUIRegistrySearchResponse> {
    const searchParams = {
      page: params.page || 1,
      limit: params.limit || 50,
      search: params.search,
      include_banned: params.include_banned || false
    }

    return this.makeRequest<ComfyUIRegistrySearchResponse>('/nodes/search', searchParams)
  }

  /**
   * List nodes from the ComfyUI Registry
   */
  async listNodes(params: ComfyUIRegistryListParams = {}): Promise<ComfyUIRegistrySearchResponse> {
    const listParams = {
      page: params.page || 1,
      limit: params.limit || 50,
      include_banned: params.include_banned || false,
      timestamp: params.timestamp,
      latest: params.latest
    }

    return this.makeRequest<ComfyUIRegistrySearchResponse>('/nodes', listParams)
  }

  /**
   * Get detailed information about a specific node
   */
  async getNode(nodeId: string): Promise<ComfyUIRegistryNode> {
    return this.makeRequest<ComfyUIRegistryNode>(`/nodes/${nodeId}`)
  }

  /**
   * Get all versions of a specific node
   */
  async getNodeVersions(nodeId: string): Promise<{ versions: ComfyUIRegistryNodeVersion[] }> {
    return this.makeRequest<{ versions: ComfyUIRegistryNodeVersion[] }>(`/nodes/${nodeId}/versions`)
  }

  /**
   * Get specific version of a node
   */
  async getNodeVersion(nodeId: string, versionId: string): Promise<ComfyUIRegistryNodeVersion> {
    return this.makeRequest<ComfyUIRegistryNodeVersion>(`/nodes/${nodeId}/versions/${versionId}`)
  }

  /**
   * Get installation data for a node
   */
  async getNodeInstallData(nodeId: string, versionId?: string): Promise<ComfyUIRegistryInstallData> {
    const endpoint = versionId 
      ? `/nodes/${nodeId}/install?version=${versionId}`
      : `/nodes/${nodeId}/install`
    
    return this.makeRequest<ComfyUIRegistryInstallData>(endpoint)
  }

  /**
   * Helper method to extract GitHub URL from repository field
   */
  extractGitHubUrl(repository?: string): string | null {
    if (!repository) return null
    
    // Handle different repository URL formats
    if (repository.startsWith('https://github.com/')) {
      return repository
    }
    
    if (repository.startsWith('git@github.com:')) {
      return repository.replace('git@github.com:', 'https://github.com/').replace('.git', '')
    }
    
    // Handle short format like "username/repo"
    if (repository.includes('/') && !repository.includes('://')) {
      return `https://github.com/${repository}`
    }
    
    return null
  }

  /**
   * Get popular/trending nodes
   */
  async getPopularNodes(limit: number = 20): Promise<ComfyUIRegistrySearchResponse> {
    return this.listNodes({
      limit,
      latest: true
    })
  }

  /**
   * Get nodes by category
   */
  async getNodesByCategory(category: string, limit: number = 50): Promise<ComfyUIRegistrySearchResponse> {
    return this.searchNodes({
      search: category,
      limit
    })
  }

  /**
   * Utility methods
   */
  isNodeSafe(node: ComfyUIRegistryNode): boolean {
    return node.status !== 'banned' && node.status !== 'suspended'
  }

  getNodeTags(node: ComfyUIRegistryNode): string[] {
    return node.tags || []
  }

  getLatestVersion(node: ComfyUIRegistryNode): ComfyUIRegistryNodeVersion | null {
    return node.latest_version || null
  }
}

// Create singleton instance
export const comfyUIRegistryClient = new ComfyUIRegistryClient()

// Factory function to create client with dynamic token from database
export async function createComfyUIRegistryClient(): Promise<ComfyUIRegistryClient> {
  try {
    const { getApiToken } = await import('@/lib/token-service')
    const token = await getApiToken('COMFYUI_REGISTRY')
    return new ComfyUIRegistryClient(token)
  } catch (error) {
    console.warn('Failed to get ComfyUI Registry token from database, using no authentication')
    return new ComfyUIRegistryClient()
  }
}

// Export types for use in other files
export type {
  ComfyUIRegistryNode,
  ComfyUIRegistrySearchParams,
  ComfyUIRegistryListParams,
  ComfyUIRegistrySearchResponse,
  ComfyUIRegistryNodeVersion,
  ComfyUIRegistryInstallData
}