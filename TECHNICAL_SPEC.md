# ComfyUI Deployment Builder - Technical Specification

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │   Database      │
│   (Next.js)     │◄──►│   (Next.js API)  │◄──►│   (SQLite/PG)   │
│   - React       │    │   - Routes       │    │   - Prisma ORM  │
│   - TypeScript  │    │   - Auth         │    │   - Migrations  │
│   - shadcn/ui   │    │   - Validation   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                        │
        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐
│   External APIs │    │   File System    │
│   - CivitAI     │    │   - Generated    │
│   - HuggingFace │    │     Scripts      │
│   - GitHub      │    │   - Templates    │
└─────────────────┘    └──────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript 5+
- **UI Library**: shadcn/ui (Radix UI + Tailwind CSS)
- **State Management**: React Query/TanStack Query
- **Form Handling**: React Hook Form + Zod validation
- **Styling**: Tailwind CSS

### Backend
- **API**: Next.js API Routes (App Router)
- **Authentication**: NextAuth.js v5
- **Database ORM**: Prisma
- **Validation**: Zod schemas
- **File Operations**: Node.js fs/promises

### Database
- **Development**: SQLite (via Prisma)
- **Production**: PostgreSQL (migration ready)
- **Migrations**: Prisma migrate

### External Integrations
- **HTTP Client**: fetch (native) with retry logic
- **Rate Limiting**: Built-in API route protection
- **Caching**: Next.js caching + Redis (future)

## Project Structure

```
comfyui-deployment-builder/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth-protected routes
│   │   ├── admin/               # Admin interface
│   │   ├── dashboard/           # User dashboard
│   │   └── builder/             # Deployment builder
│   ├── api/                     # API routes
│   │   ├── auth/                # Authentication endpoints
│   │   ├── civitai/             # CivitAI integration
│   │   ├── huggingface/         # HuggingFace integration
│   │   ├── comfyui/             # ComfyUI Manager integration
│   │   ├── deployments/         # Deployment CRUD
│   │   └── generate/            # Script generation
│   ├── components/              # Reusable UI components
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── forms/               # Form components
│   │   ├── tables/              # Data tables
│   │   └── builders/            # Deployment builder UI
│   ├── lib/                     # Utilities and configuration
│   │   ├── db.ts               # Database client
│   │   ├── auth.ts             # Auth configuration
│   │   ├── validations.ts      # Zod schemas
│   │   └── utils.ts            # Helper functions
│   └── types/                   # TypeScript type definitions
├── prisma/                      # Database schema and migrations
│   ├── schema.prisma           # Prisma schema
│   ├── migrations/             # Migration files
│   └── seed.ts                 # Database seeding
├── scripts/                     # Utility scripts
│   ├── sync-comfyui-nodes.ts  # ComfyUI Manager sync
│   ├── validate-urls.ts       # URL validation
│   └── generate-templates.ts   # Script templates
└── templates/                   # Script generation templates
    ├── runpod-base.sh         # Base RunPod template
    ├── docker-compose.yml     # Docker template
    └── nvidia-docker.sh       # GPU-optimized template
```

## Database Schema

### Core Tables

```prisma
// User management
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String?
  role        Role     @default(USER)
  apiTokens   ApiToken[]
  deployments Deployment[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ApiToken {
  id       String    @id @default(cuid())
  name     String
  service  Service   // CIVITAI, HUGGINGFACE
  token    String    // Encrypted
  userId   String
  user     User      @relation(fields: [userId], references: [id])
  isActive Boolean   @default(true)
  createdAt DateTime @default(now())
}

// Content models
model CustomNode {
  id              String   @id @default(cuid())
  name            String
  githubUrl       String   @unique
  description     String?
  pipRequirements String[] // JSON array
  tags            String[]
  installType     String   @default("git")
  isActive        Boolean  @default(true)
  deploymentNodes DeploymentNode[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Model {
  id             String   @id @default(cuid())
  source         Source   // CIVITAI, HUGGINGFACE, DIRECT
  sourceId       String?  // External ID
  name           String
  type           ModelType // CHECKPOINT, LORA, VAE, CONTROLNET, etc.
  category       String?
  downloadUrl    String
  filename       String?
  authRequired   Boolean  @default(false)
  metadata       Json?    // Flexible metadata storage
  isActive       Boolean  @default(true)
  deploymentModels DeploymentModel[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

// Deployment configuration
model Deployment {
  id               String   @id @default(cuid())
  name             String
  description      String?
  userId           String
  user             User     @relation(fields: [userId], references: [id])
  isTemplate       Boolean  @default(false)
  isPublic         Boolean  @default(false)
  deploymentNodes  DeploymentNode[]
  deploymentModels DeploymentModel[]
  systemPackages   SystemPackage[]
  generatedScript  String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model DeploymentNode {
  deploymentId   String
  customNodeId   String
  deployment     Deployment @relation(fields: [deploymentId], references: [id])
  customNode     CustomNode @relation(fields: [customNodeId], references: [id])
  
  @@id([deploymentId, customNodeId])
}

model DeploymentModel {
  deploymentId String
  modelId      String
  targetPath   String  // Where to install in ComfyUI
  deployment   Deployment @relation(fields: [deploymentId], references: [id])
  model        Model      @relation(fields: [modelId], references: [id])
  
  @@id([deploymentId, modelId])
}

model SystemPackage {
  id           String     @id @default(cuid())
  deploymentId String
  packageType  PackageType // APT, PIP
  name         String
  version      String?
  deployment   Deployment @relation(fields: [deploymentId], references: [id])
}

// Enums
enum Role {
  ADMIN
  CURATOR
  USER
}

enum Service {
  CIVITAI
  HUGGINGFACE
}

enum Source {
  CIVITAI
  HUGGINGFACE
  DIRECT
}

enum ModelType {
  CHECKPOINT
  LORA
  VAE
  CONTROLNET
  UPSCALER
  EMBEDDING
  HYPERNETWORK
  UNET
  CLIP
}

enum PackageType {
  APT
  PIP
}
```

## API Endpoints

### Authentication
```typescript
POST /api/auth/signin
POST /api/auth/signout
GET  /api/auth/session
POST /api/auth/register
```

### User Management
```typescript
GET    /api/users/profile
PUT    /api/users/profile
POST   /api/users/api-tokens
DELETE /api/users/api-tokens/[id]
```

### Custom Nodes
```typescript
GET    /api/custom-nodes              # List with pagination/filtering
POST   /api/custom-nodes              # Create new (admin only)
GET    /api/custom-nodes/[id]         # Get details
PUT    /api/custom-nodes/[id]         # Update (admin only)
DELETE /api/custom-nodes/[id]         # Delete (admin only)
POST   /api/custom-nodes/sync         # Sync from ComfyUI Manager
```

### Models
```typescript
GET    /api/models                    # List with pagination/filtering
POST   /api/models                    # Create new (admin only)
GET    /api/models/[id]               # Get details
PUT    /api/models/[id]               # Update (admin only)
DELETE /api/models/[id]               # Delete (admin only)
```

### CivitAI Integration
```typescript
GET    /api/civitai/search            # Search models
GET    /api/civitai/models/[id]       # Get model details
POST   /api/civitai/import            # Import to database
GET    /api/civitai/categories        # Get categories/tags
```

### HuggingFace Integration
```typescript
GET    /api/huggingface/search        # Search repositories
GET    /api/huggingface/repo/[id]     # Get repo details
POST   /api/huggingface/import        # Import to database
```

### Deployments
```typescript
GET    /api/deployments               # List user deployments
POST   /api/deployments               # Create deployment
GET    /api/deployments/[id]          # Get deployment
PUT    /api/deployments/[id]          # Update deployment
DELETE /api/deployments/[id]          # Delete deployment
POST   /api/deployments/[id]/generate # Generate script
```

## External API Integration

### CivitAI API Client
```typescript
class CivitAIClient {
  private baseUrl = 'https://civitai.com/api/v1';
  
  async searchModels(params: SearchParams): Promise<Model[]> {
    const url = new URL(`${this.baseUrl}/models`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value.toString());
    });
    
    const response = await fetch(url.toString(), {
      headers: this.getHeaders(params.token)
    });
    
    return this.handleResponse(response);
  }
  
  async getModel(id: string, token?: string): Promise<ModelDetail> {
    const response = await fetch(`${this.baseUrl}/models/${id}`, {
      headers: this.getHeaders(token)
    });
    
    return this.handleResponse(response);
  }
  
  private getHeaders(token?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }
}
```

### HuggingFace API Client
```typescript
class HuggingFaceClient {
  private baseUrl = 'https://huggingface.co/api';
  
  async searchRepos(query: string): Promise<Repository[]> {
    const response = await fetch(
      `${this.baseUrl}/models?search=${encodeURIComponent(query)}`
    );
    
    return this.handleResponse(response);
  }
  
  async getRepoInfo(repoId: string): Promise<RepositoryDetail> {
    const response = await fetch(`${this.baseUrl}/models/${repoId}`);
    return this.handleResponse(response);
  }
  
  async getRepoFiles(repoId: string): Promise<FileInfo[]> {
    const response = await fetch(
      `${this.baseUrl}/models/${repoId}/tree/main`
    );
    return this.handleResponse(response);
  }
}
```

### ComfyUI Manager Integration
```typescript
class ComfyUIManagerClient {
  private baseUrl = 'https://raw.githubusercontent.com/ltdrdata/ComfyUI-Manager/main';
  
  async getNodeDatabase(): Promise<CustomNodeData[]> {
    const response = await fetch(`${this.baseUrl}/custom-node-list.json`);
    const data = await response.json();
    return data.custom_nodes;
  }
  
  async getExtensionNodeMap(): Promise<ExtensionMap> {
    const response = await fetch(`${this.baseUrl}/extension-node-map.json`);
    return response.json();
  }
  
  async syncToDatabase(): Promise<SyncResult> {
    const nodes = await this.getNodeDatabase();
    const results = [];
    
    for (const node of nodes) {
      const result = await this.upsertNode(node);
      results.push(result);
    }
    
    return { 
      total: nodes.length, 
      created: results.filter(r => r.created).length,
      updated: results.filter(r => r.updated).length 
    };
  }
}
```

## Script Generation Engine

### Template System
```typescript
interface ScriptTemplate {
  name: string;
  description: string;
  template: string;
  variables: TemplateVariable[];
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'array' | 'boolean';
  required: boolean;
  default?: any;
}

class ScriptGenerator {
  generateRunPodScript(deployment: Deployment): string {
    const template = this.loadTemplate('runpod-base.sh');
    const variables = this.buildVariables(deployment);
    
    return this.renderTemplate(template, variables);
  }
  
  private buildVariables(deployment: Deployment) {
    return {
      APT_PACKAGES: this.getAptPackages(deployment),
      PIP_PACKAGES: this.getPipPackages(deployment),
      NODES: this.getCustomNodes(deployment),
      CHECKPOINT_MODELS: this.getModelsByType(deployment, 'CHECKPOINT'),
      LORA_MODELS: this.getModelsByType(deployment, 'LORA'),
      // ... other model types
    };
  }
  
  private renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;
    
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(
        new RegExp(placeholder, 'g'), 
        this.formatVariable(value)
      );
    });
    
    return rendered;
  }
}
```

## Security Considerations

### API Token Management
```typescript
import { encrypt, decrypt } from '@/lib/crypto';

class TokenManager {
  async storeToken(userId: string, service: string, token: string) {
    const encrypted = encrypt(token);
    
    return await db.apiToken.create({
      data: {
        userId,
        service,
        token: encrypted,
        name: `${service} Token`
      }
    });
  }
  
  async getToken(userId: string, service: string): Promise<string | null> {
    const tokenRecord = await db.apiToken.findFirst({
      where: { userId, service, isActive: true }
    });
    
    return tokenRecord ? decrypt(tokenRecord.token) : null;
  }
}
```

### Input Validation
```typescript
import { z } from 'zod';

export const createDeploymentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  nodeIds: z.array(z.string().cuid()),
  modelIds: z.array(z.string().cuid()),
  isPublic: z.boolean().default(false)
});

export const civitaiSearchSchema = z.object({
  query: z.string().min(1),
  types: z.array(z.enum(['Checkpoint', 'LORA', 'Embedding'])).optional(),
  limit: z.number().min(1).max(100).default(20),
  page: z.number().min(1).default(1)
});
```

## Performance Optimization

### Caching Strategy
```typescript
import { unstable_cache as cache } from 'next/cache';

export const getCachedNodeDatabase = cache(
  async () => {
    const client = new ComfyUIManagerClient();
    return client.getNodeDatabase();
  },
  ['comfyui-nodes'],
  { revalidate: 3600 } // 1 hour
);

export const getCachedCivitAIModels = cache(
  async (query: string, filters: SearchFilters) => {
    const client = new CivitAIClient();
    return client.searchModels({ query, ...filters });
  },
  ['civitai-search'],
  { revalidate: 300 } // 5 minutes
);
```

### Database Optimization
```sql
-- Indexes for performance
CREATE INDEX idx_models_type_source ON models(type, source);
CREATE INDEX idx_custom_nodes_tags ON custom_nodes USING GIN(tags);
CREATE INDEX idx_deployments_user_created ON deployments(user_id, created_at);
```

## Error Handling

### API Error Responses
```typescript
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function handleAPIError(error: unknown): Response {
  if (error instanceof APIError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  
  console.error('Unexpected error:', error);
  return Response.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

### Retry Logic
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Testing Strategy

### Unit Tests
```typescript
// Example test for script generation
describe('ScriptGenerator', () => {
  it('should generate valid RunPod script', () => {
    const deployment = createMockDeployment();
    const generator = new ScriptGenerator();
    
    const script = generator.generateRunPodScript(deployment);
    
    expect(script).toContain('#!/bin/bash');
    expect(script).toContain('APT_PACKAGES=(');
    expect(script).toMatch(/NODES=\(/);
  });
});
```

### API Tests
```typescript
describe('/api/deployments', () => {
  it('should create deployment with valid data', async () => {
    const response = await POST('/api/deployments', {
      body: JSON.stringify(validDeploymentData),
      headers: { 'Content-Type': 'application/json' }
    });
    
    expect(response.status).toBe(201);
    const deployment = await response.json();
    expect(deployment.id).toBeDefined();
  });
});
```

## Deployment Configuration

### Environment Variables
```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/comfyui_builder"

# Authentication
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# External APIs
CIVITAI_API_BASE="https://civitai.com/api/v1"
HUGGINGFACE_API_BASE="https://huggingface.co/api"

# Encryption
ENCRYPTION_KEY="your-encryption-key"

# Feature Flags
ENABLE_ADMIN_REGISTRATION="false"
ENABLE_PUBLIC_DEPLOYMENTS="true"
```

### Docker Configuration
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

This technical specification provides the foundation for implementing the ComfyUI Deployment Builder with modern web development practices, robust error handling, and scalable architecture.