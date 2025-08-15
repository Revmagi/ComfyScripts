# ComfyUI Deployment Builder - API Integration Specifications

## Overview

This document details the integration specifications for external APIs used by the ComfyUI Deployment Builder. Each integration includes authentication methods, rate limiting strategies, error handling, and caching mechanisms.

## CivitAI API Integration

### Base Configuration

```typescript
interface CivitAIConfig {
  baseUrl: string;
  apiVersion: string;
  timeout: number;
  retryAttempts: number;
  rateLimitPerMinute: number;
}

const CIVITAI_CONFIG: CivitAIConfig = {
  baseUrl: 'https://civitai.com/api',
  apiVersion: 'v1',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  rateLimitPerMinute: 60 // Conservative rate limit
};
```

### Authentication

```typescript
interface CivitAIAuth {
  token?: string;
}

class CivitAIClient {
  private auth: CivitAIAuth;
  
  constructor(auth: CivitAIAuth = {}) {
    this.auth = auth;
  }
  
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ComfyUI-Deployment-Builder/1.0'
    };
    
    if (this.auth.token) {
      headers['Authorization'] = `Bearer ${this.auth.token}`;
    }
    
    return headers;
  }
}
```

### Core API Methods

#### Search Models

```typescript
interface CivitAISearchParams {
  limit?: number;        // Max 200, default 20
  page?: number;         // Default 1
  query?: string;        // Search term
  tag?: string;          // Filter by tag
  username?: string;     // Filter by creator
  types?: ModelType[];   // Filter by model types
  sort?: 'Highest Rated' | 'Most Downloaded' | 'Newest';
  period?: 'AllTime' | 'Year' | 'Month' | 'Week' | 'Day';
  rating?: number;       // Minimum rating
  favorites?: boolean;   // User's favorites (requires auth)
  hidden?: boolean;      // Include hidden models (requires auth)
}

interface CivitAIModel {
  id: number;
  name: string;
  description: string;
  type: string;
  nsfw: boolean;
  allowNoCredit: boolean;
  allowCommercialUse: string;
  allowDerivatives: boolean;
  allowDifferentLicense: boolean;
  stats: {
    downloadCount: number;
    favoriteCount: number;
    commentCount: number;
    ratingCount: number;
    rating: number;
  };
  creator: {
    username: string;
    image?: string;
  };
  tags: string[];
  modelVersions: CivitAIModelVersion[];
}

interface CivitAIModelVersion {
  id: number;
  name: string;
  description: string;
  downloadUrl: string;
  baseModel: string;
  files: CivitAIFile[];
  images: CivitAIImage[];
  trainedWords: string[];
}

interface CivitAIFile {
  id: number;
  name: string;
  downloadUrl: string;
  sizeKB: number;
  type: string;
  format: string;
  pickleScanResult: string;
  pickleScanMessage?: string;
  virusScanResult: string;
  scannedAt: string;
  hashes: {
    AutoV1?: string;
    AutoV2?: string;
    SHA256?: string;
    CRC32?: string;
    BLAKE3?: string;
  };
}

class CivitAIClient {
  async searchModels(params: CivitAISearchParams = {}): Promise<{
    items: CivitAIModel[];
    metadata: {
      totalItems: number;
      currentPage: number;
      pageSize: number;
      totalPages: number;
    };
  }> {
    const url = new URL(`${CIVITAI_CONFIG.baseUrl}/${CIVITAI_CONFIG.apiVersion}/models`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, v.toString()));
        } else {
          url.searchParams.append(key, value.toString());
        }
      }
    });
    
    const response = await this.makeRequest(url.toString());
    return response;
  }
  
  async getModel(id: number): Promise<CivitAIModel> {
    const url = `${CIVITAI_CONFIG.baseUrl}/${CIVITAI_CONFIG.apiVersion}/models/${id}`;
    return this.makeRequest(url);
  }
  
  async getModelVersion(versionId: number): Promise<CivitAIModelVersion> {
    const url = `${CIVITAI_CONFIG.baseUrl}/${CIVITAI_CONFIG.apiVersion}/model-versions/${versionId}`;
    return this.makeRequest(url);
  }
}
```

#### Download URL Generation

```typescript
interface DownloadOptions {
  type?: 'Model' | 'VAE' | 'Pruned Model';
  format?: 'SafeTensor' | 'PickleTensor' | 'Other';
  size?: 'full' | 'pruned';
  fp?: 'fp16' | 'fp32';
}

class CivitAIClient {
  generateDownloadUrl(versionId: number, options: DownloadOptions = {}): string {
    const url = new URL(`${CIVITAI_CONFIG.baseUrl}/${CIVITAI_CONFIG.apiVersion}/model-versions/${versionId}/download`);
    
    if (this.auth.token) {
      url.searchParams.append('token', this.auth.token);
    }
    
    Object.entries(options).forEach(([key, value]) => {
      if (value) {
        url.searchParams.append(key, value);
      }
    });
    
    return url.toString();
  }
  
  async getDownloadMetadata(versionId: number): Promise<{
    filename: string;
    size: number;
    contentType: string;
  }> {
    const downloadUrl = this.generateDownloadUrl(versionId);
    
    const response = await fetch(downloadUrl, {
      method: 'HEAD',
      headers: this.getHeaders()
    });
    
    const contentDisposition = response.headers.get('content-disposition');
    const filename = this.parseFilename(contentDisposition);
    const size = parseInt(response.headers.get('content-length') || '0');
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    return { filename, size, contentType };
  }
}
```

## HuggingFace API Integration

### Base Configuration

```typescript
interface HuggingFaceConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  rateLimitPerMinute: number;
}

const HUGGINGFACE_CONFIG: HuggingFaceConfig = {
  baseUrl: 'https://huggingface.co/api',
  timeout: 30000,
  retryAttempts: 3,
  rateLimitPerMinute: 100
};
```

### Authentication

```typescript
interface HuggingFaceAuth {
  token?: string; // HF API token for private repos
}

class HuggingFaceClient {
  private auth: HuggingFaceAuth;
  
  constructor(auth: HuggingFaceAuth = {}) {
    this.auth = auth;
  }
  
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'ComfyUI-Deployment-Builder/1.0'
    };
    
    if (this.auth.token) {
      headers['Authorization'] = `Bearer ${this.auth.token}`;
    }
    
    return headers;
  }
}
```

### Core API Methods

#### Repository Operations

```typescript
interface HuggingFaceRepo {
  id: string;
  modelId: string;
  author: string;
  sha: string;
  lastModified: string;
  private: boolean;
  gated: boolean;
  disabled: boolean;
  downloads: number;
  likes: number;
  library_name?: string;
  tags: string[];
  pipeline_tag?: string;
  mask_token?: string;
  widget_data?: any;
  model_index?: any;
  config?: any;
  transformers_info?: any;
  cardData?: any;
  spaces?: string[];
  safetensors?: {
    parameters: Record<string, number>;
    total: number;
  };
}

interface HuggingFaceFile {
  path: string;
  size: number;
  blob_id: string;
  lfs?: {
    size: number;
    sha256: string;
    pointer_size: number;
  };
}

class HuggingFaceClient {
  async searchRepositories(params: {
    search?: string;
    author?: string;
    filter?: string;
    sort?: string;
    direction?: 'ascending' | 'descending';
    limit?: number;
    full?: boolean;
    config?: boolean;
  } = {}): Promise<HuggingFaceRepo[]> {
    const url = new URL(`${HUGGINGFACE_CONFIG.baseUrl}/models`);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, value.toString());
      }
    });
    
    return this.makeRequest(url.toString());
  }
  
  async getRepository(repoId: string): Promise<HuggingFaceRepo> {
    const url = `${HUGGINGFACE_CONFIG.baseUrl}/models/${repoId}`;
    return this.makeRequest(url);
  }
  
  async getRepositoryFiles(
    repoId: string, 
    revision: string = 'main'
  ): Promise<HuggingFaceFile[]> {
    const url = `${HUGGINGFACE_CONFIG.baseUrl}/models/${repoId}/tree/${revision}`;
    return this.makeRequest(url);
  }
  
  async getFileInfo(
    repoId: string, 
    filename: string, 
    revision: string = 'main'
  ): Promise<HuggingFaceFile> {
    const url = `${HUGGINGFACE_CONFIG.baseUrl}/models/${repoId}/resolve/${revision}/${filename}`;
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: this.getHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`File not found: ${filename}`);
    }
    
    const size = parseInt(response.headers.get('content-length') || '0');
    const etag = response.headers.get('etag')?.replace(/"/g, '') || '';
    
    return {
      path: filename,
      size,
      blob_id: etag,
    };
  }
}
```

#### Download URL Generation

```typescript
class HuggingFaceClient {
  generateDownloadUrl(
    repoId: string, 
    filename: string, 
    revision: string = 'main'
  ): string {
    return `https://huggingface.co/${repoId}/resolve/${revision}/${filename}`;
  }
  
  generateLfsDownloadUrl(
    repoId: string, 
    filename: string, 
    revision: string = 'main'
  ): string {
    // For LFS files, use the same URL - HF handles redirect
    return this.generateDownloadUrl(repoId, filename, revision);
  }
  
  async validateDownloadUrl(url: string): Promise<{
    isValid: boolean;
    size?: number;
    filename?: string;
    isLfs?: boolean;
  }> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        return { isValid: false };
      }
      
      const size = parseInt(response.headers.get('content-length') || '0');
      const contentDisposition = response.headers.get('content-disposition');
      const filename = this.parseFilename(contentDisposition) || url.split('/').pop();
      const isLfs = response.headers.get('x-linked-size') !== null;
      
      return {
        isValid: true,
        size,
        filename,
        isLfs
      };
    } catch {
      return { isValid: false };
    }
  }
}
```

## ComfyUI Manager API Integration

### GitHub Raw File Access

```typescript
interface ComfyUIManagerConfig {
  baseUrl: string;
  repoOwner: string;
  repoName: string;
  branch: string;
}

const COMFYUI_MANAGER_CONFIG: ComfyUIManagerConfig = {
  baseUrl: 'https://raw.githubusercontent.com',
  repoOwner: 'ltdrdata',
  repoName: 'ComfyUI-Manager',
  branch: 'main'
};

interface ComfyUICustomNode {
  title: string;
  reference: string;
  files: string[];
  install_type: string;
  description?: string;
  pip?: string[];
  js?: string[];
  tags?: string[];
  author?: string;
  preemptions?: string[];
  nodename_pattern?: string;
}

interface ComfyUINodeDatabase {
  custom_nodes: ComfyUICustomNode[];
}

class ComfyUIManagerClient {
  async getNodeDatabase(): Promise<ComfyUINodeDatabase> {
    const url = `${COMFYUI_MANAGER_CONFIG.baseUrl}/${COMFYUI_MANAGER_CONFIG.repoOwner}/${COMFYUI_MANAGER_CONFIG.repoName}/${COMFYUI_MANAGER_CONFIG.branch}/custom-node-list.json`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ComfyUI-Deployment-Builder/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch node database: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getExtensionNodeMap(): Promise<Record<string, any>> {
    const url = `${COMFYUI_MANAGER_CONFIG.baseUrl}/${COMFYUI_MANAGER_CONFIG.repoOwner}/${COMFYUI_MANAGER_CONFIG.repoName}/${COMFYUI_MANAGER_CONFIG.branch}/extension-node-map.json`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch extension node map: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getAlternativeList(): Promise<any> {
    const url = `${COMFYUI_MANAGER_CONFIG.baseUrl}/${COMFYUI_MANAGER_CONFIG.repoOwner}/${COMFYUI_MANAGER_CONFIG.repoName}/${COMFYUI_MANAGER_CONFIG.branch}/alter-list.json`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch alternative list: ${response.statusText}`);
    }
    
    return response.json();
  }
}
```

### GitHub Repository Analysis

```typescript
interface GitHubRepoInfo {
  owner: string;
  repo: string;
  description?: string;
  stars: number;
  lastUpdated: string;
  defaultBranch: string;
  topics: string[];
  hasRequirements: boolean;
  hasSetupPy: boolean;
  hasPyprojectToml: boolean;
}

class GitHubAnalyzer {
  private token?: string;
  
  constructor(token?: string) {
    this.token = token;
  }
  
  async analyzeRepository(githubUrl: string): Promise<GitHubRepoInfo> {
    const { owner, repo } = this.parseGitHubUrl(githubUrl);
    
    // Get repository info
    const repoInfo = await this.getRepositoryInfo(owner, repo);
    
    // Check for Python dependency files
    const [hasRequirements, hasSetupPy, hasPyprojectToml] = await Promise.all([
      this.fileExists(owner, repo, 'requirements.txt'),
      this.fileExists(owner, repo, 'setup.py'),
      this.fileExists(owner, repo, 'pyproject.toml')
    ]);
    
    return {
      owner,
      repo,
      description: repoInfo.description,
      stars: repoInfo.stargazers_count,
      lastUpdated: repoInfo.updated_at,
      defaultBranch: repoInfo.default_branch,
      topics: repoInfo.topics || [],
      hasRequirements,
      hasSetupPy,
      hasPyprojectToml
    };
  }
  
  async getRequirements(githubUrl: string): Promise<string[]> {
    const { owner, repo } = this.parseGitHubUrl(githubUrl);
    
    try {
      const content = await this.getFileContent(owner, repo, 'requirements.txt');
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    } catch {
      return [];
    }
  }
  
  private parseGitHubUrl(url: string): { owner: string; repo: string } {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error(`Invalid GitHub URL: ${url}`);
    }
    
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, '')
    };
  }
  
  private async getRepositoryInfo(owner: string, repo: string): Promise<any> {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const headers: Record<string, string> = {
      'User-Agent': 'ComfyUI-Deployment-Builder/1.0'
    };
    
    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }
    
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch repository info: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  private async fileExists(owner: string, repo: string, path: string): Promise<boolean> {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      const headers: Record<string, string> = {
        'User-Agent': 'ComfyUI-Deployment-Builder/1.0'
      };
      
      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }
      
      const response = await fetch(url, { headers });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  private async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file content: ${response.statusText}`);
    }
    
    return response.text();
  }
}
```

## Rate Limiting & Error Handling

### Rate Limiter Implementation

```typescript
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
}

class RateLimiter {
  private requests: number[] = [];
  private config: RateLimitConfig;
  
  constructor(config: RateLimitConfig) {
    this.config = config;
  }
  
  async checkLimit(): Promise<boolean> {
    const now = Date.now();
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.config.windowMs
    );
    
    // Check if we're at the limit
    if (this.requests.length >= this.config.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.config.windowMs - (now - oldestRequest);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.checkLimit();
      }
    }
    
    // Add current request
    this.requests.push(now);
    return true;
  }
}

// Rate limiters for each service
const rateLimiters = {
  civitai: new RateLimiter({ maxRequests: 60, windowMs: 60000 }),
  huggingface: new RateLimiter({ maxRequests: 100, windowMs: 60000 }),
  github: new RateLimiter({ maxRequests: 60, windowMs: 60000 })
};
```

### Error Handling & Retry Logic

```typescript
interface RetryConfig {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
  retryOn: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  backoffMs: 1000,
  backoffMultiplier: 2,
  retryOn: [408, 429, 500, 502, 503, 504]
};

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof APIError && !config.retryOn.includes(error.statusCode)) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === config.maxAttempts) {
        break;
      }
      
      // Calculate backoff delay
      const delay = config.backoffMs * Math.pow(config.backoffMultiplier, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Base client with error handling
abstract class BaseAPIClient {
  protected async makeRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await withRetry(async () => {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers
        }
      });
      
      if (!res.ok) {
        const errorBody = await res.text();
        throw new APIError(
          `HTTP ${res.status}: ${res.statusText}`,
          res.status,
          errorBody
        );
      }
      
      return res;
    });
    
    return response.json();
  }
  
  protected abstract getHeaders(): Record<string, string>;
}
```

## Caching Strategy

### Cache Implementation

```typescript
interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum cache size
}

class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private config: CacheConfig;
  
  constructor(config: CacheConfig) {
    this.config = config;
  }
  
  set(key: string, data: any, ttl?: number): void {
    const expires = Date.now() + (ttl || this.config.ttl);
    
    // Remove expired entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      this.cleanup();
    }
    
    this.cache.set(key, { data, expires });
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry || entry.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        toDelete.push(key);
      }
    }
    
    toDelete.forEach(key => this.cache.delete(key));
  }
}

// Cache instances for different data types
const caches = {
  models: new MemoryCache({ ttl: 300000, maxSize: 1000 }), // 5 minutes
  nodes: new MemoryCache({ ttl: 3600000, maxSize: 500 }), // 1 hour
  repos: new MemoryCache({ ttl: 1800000, maxSize: 200 })  // 30 minutes
};

// Cached client wrapper
function withCache<T>(
  cacheInstance: MemoryCache,
  keyPrefix: string
) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(...args: any[]): Promise<T> {
      const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`;
      
      // Try cache first
      const cached = cacheInstance.get(cacheKey);
      if (cached) {
        return cached;
      }
      
      // Call original method
      const result = await method.apply(this, args);
      
      // Cache result
      cacheInstance.set(cacheKey, result);
      
      return result;
    };
  };
}
```

## Database Sync Operations

### Sync Job Management

```typescript
interface SyncJobConfig {
  type: 'COMFYUI_NODES' | 'CIVITAI_MODELS' | 'URL_VALIDATION';
  batchSize: number;
  maxConcurrency: number;
}

class SyncJobManager {
  async createSyncJob(config: SyncJobConfig): Promise<string> {
    const job = await db.syncJob.create({
      data: {
        type: config.type,
        status: 'PENDING'
      }
    });
    
    // Start job in background
    this.runSyncJob(job.id, config);
    
    return job.id;
  }
  
  private async runSyncJob(jobId: string, config: SyncJobConfig): Promise<void> {
    try {
      await db.syncJob.update({
        where: { id: jobId },
        data: { 
          status: 'RUNNING',
          startedAt: new Date()
        }
      });
      
      switch (config.type) {
        case 'COMFYUI_NODES':
          await this.syncComfyUINodes(jobId, config);
          break;
        case 'CIVITAI_MODELS':
          await this.syncCivitAIModels(jobId, config);
          break;
        case 'URL_VALIDATION':
          await this.validateUrls(jobId, config);
          break;
      }
      
      await db.syncJob.update({
        where: { id: jobId },
        data: { 
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });
      
    } catch (error) {
      await db.syncJob.update({
        where: { id: jobId },
        data: { 
          status: 'FAILED',
          completedAt: new Date(),
          errorLog: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }
  
  private async syncComfyUINodes(jobId: string, config: SyncJobConfig): Promise<void> {
    const client = new ComfyUIManagerClient();
    const nodeDatabase = await client.getNodeDatabase();
    
    await db.syncJob.update({
      where: { id: jobId },
      data: { totalItems: nodeDatabase.custom_nodes.length }
    });
    
    // Process in batches
    for (let i = 0; i < nodeDatabase.custom_nodes.length; i += config.batchSize) {
      const batch = nodeDatabase.custom_nodes.slice(i, i + config.batchSize);
      
      await Promise.all(
        batch.map(async (node) => {
          try {
            await this.upsertCustomNode(node);
            
            await db.syncJob.update({
              where: { id: jobId },
              data: { 
                processedItems: { increment: 1 },
                successItems: { increment: 1 }
              }
            });
          } catch (error) {
            console.error(`Failed to sync node ${node.title}:`, error);
            
            await db.syncJob.update({
              where: { id: jobId },
              data: { 
                processedItems: { increment: 1 },
                failedItems: { increment: 1 }
              }
            });
          }
        })
      );
    }
  }
  
  private async upsertCustomNode(node: ComfyUICustomNode): Promise<void> {
    const githubUrl = node.files[0];
    if (!githubUrl) return;
    
    await db.customNode.upsert({
      where: { githubUrl },
      update: {
        name: node.title,
        description: node.description,
        author: node.author,
        pipRequirements: JSON.stringify(node.pip || []),
        tags: JSON.stringify(node.tags || []),
        installType: node.install_type,
        updatedAt: new Date()
      },
      create: {
        name: node.title,
        githubUrl,
        description: node.description,
        author: node.author,
        pipRequirements: JSON.stringify(node.pip || []),
        tags: JSON.stringify(node.tags || []),
        installType: node.install_type
      }
    });
  }
}
```

This comprehensive API integration specification provides the foundation for reliable, efficient, and scalable external API interactions while maintaining proper error handling, rate limiting, and caching strategies.