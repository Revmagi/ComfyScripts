# ComfyUI Deployment Builder - Database Schema Design

## Schema Overview

The database is designed with flexibility, scalability, and migration in mind. Starting with SQLite for development simplicity and ready for PostgreSQL migration in production.

## Prisma Schema Definition

```prisma
// This is your Prisma schema file.
// Learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"  // Change to "postgresql" for production
  url      = env("DATABASE_URL")
}

// ================================
// USER MANAGEMENT & AUTHENTICATION
// ================================

model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String?
  image       String?
  role        Role     @default(USER)
  isActive    Boolean  @default(true)
  
  // Relations
  apiTokens   ApiToken[]
  deployments Deployment[]
  
  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  lastLoginAt DateTime?
  
  @@map("users")
}

model ApiToken {
  id        String   @id @default(cuid())
  name      String   // User-friendly name for the token
  service   Service  // Which service this token is for
  token     String   // Encrypted token value
  isActive  Boolean  @default(true)
  lastUsed  DateTime?
  
  // Relations
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("api_tokens")
}

// ================================
// CONTENT MANAGEMENT
// ================================

model CustomNode {
  id              String   @id @default(cuid())
  name            String   // Display name
  githubUrl       String   @unique // Primary identifier
  branch          String   @default("main")
  description     String?
  author          String?
  
  // Installation details
  installType     String   @default("git") // git, copy, etc.
  pipRequirements String   @default("[]")  // JSON array of pip packages
  jsFiles         String   @default("[]")  // JSON array of JS files
  
  // Metadata
  tags            String   @default("[]")  // JSON array of tags
  nodeClasses     String   @default("[]")  // JSON array of provided node classes
  
  // Status
  isActive        Boolean  @default(true)
  isVerified      Boolean  @default(false) // Manually verified by admin
  lastValidated   DateTime?
  
  // Relations
  deploymentNodes DeploymentNode[]
  
  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@map("custom_nodes")
}

model Model {
  id             String    @id @default(cuid())
  
  // Source information
  source         Source    // CIVITAI, HUGGINGFACE, DIRECT
  sourceId       String?   // External ID (CivitAI model ID, HF repo ID)
  sourceUrl      String?   // Original source URL
  
  // Model information
  name           String
  filename       String?   // Target filename
  type           ModelType
  category       String?   // Subcategory (anime, realistic, etc.)
  baseModel      String?   // SD1.5, SDXL, etc.
  
  // Download information
  downloadUrl    String
  fileSize       BigInt?   // File size in bytes
  authRequired   Boolean   @default(false)
  
  // Rich metadata (stored as JSON)
  metadata       String    @default("{}")  // JSON string for flexibility
  // metadata can contain: preview images, descriptions, stats, versions, etc.
  
  // Status
  isActive       Boolean   @default(true)
  isVerified     Boolean   @default(false)
  lastValidated  DateTime?
  
  // Relations
  deploymentModels DeploymentModel[]
  
  // Timestamps
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  
  @@map("models")
}

// ================================
// DEPLOYMENT CONFIGURATION
// ================================

model Deployment {
  id               String   @id @default(cuid())
  name             String
  description      String?
  
  // Ownership and visibility
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  isTemplate       Boolean  @default(false) // Can be used as template by others
  isPublic         Boolean  @default(false) // Visible to other users
  templateCategory String?  // Category if used as template
  
  // Generated content
  generatedScript  String?  // Last generated script
  scriptType       String   @default("runpod") // runpod, docker, etc.
  
  // Configuration
  environmentVars  String   @default("{}") // JSON object of env vars
  customSettings   String   @default("{}") // JSON object of custom settings
  
  // Relations
  deploymentNodes  DeploymentNode[]
  deploymentModels DeploymentModel[]
  systemPackages   SystemPackage[]
  
  // Timestamps
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  lastGenerated    DateTime?
  
  @@map("deployments")
}

model DeploymentNode {
  // Composite key
  deploymentId String
  customNodeId String
  
  // Additional configuration per node
  isEnabled    Boolean @default(true)
  config       String  @default("{}") // JSON configuration for this specific deployment
  
  // Relations
  deployment   Deployment @relation(fields: [deploymentId], references: [id], onDelete: Cascade)
  customNode   CustomNode @relation(fields: [customNodeId], references: [id], onDelete: Cascade)
  
  // Timestamps
  createdAt    DateTime @default(now())
  
  @@id([deploymentId, customNodeId])
  @@map("deployment_nodes")
}

model DeploymentModel {
  // Composite key
  deploymentId String
  modelId      String
  
  // Installation configuration
  targetPath   String  // Where to install in ComfyUI (models/checkpoints, models/loras, etc.)
  customName   String? // Override filename if needed
  isEnabled    Boolean @default(true)
  
  // Relations
  deployment   Deployment @relation(fields: [deploymentId], references: [id], onDelete: Cascade)
  model        Model      @relation(fields: [modelId], references: [id], onDelete: Cascade)
  
  // Timestamps
  createdAt    DateTime @default(now())
  
  @@id([deploymentId, modelId])
  @@map("deployment_models")
}

model SystemPackage {
  id           String      @id @default(cuid())
  deploymentId String
  
  // Package information
  packageType  PackageType // APT, PIP
  name         String
  version      String?     // Version constraint (>=1.0, ==2.0, etc.)
  installUrl   String?     // Custom install URL for pip packages
  
  // Relations
  deployment   Deployment @relation(fields: [deploymentId], references: [id], onDelete: Cascade)
  
  // Timestamps
  createdAt    DateTime @default(now())
  
  @@map("system_packages")
}

// ================================
// SYNC & MONITORING
// ================================

model SyncJob {
  id          String     @id @default(cuid())
  type        SyncType   // COMFYUI_NODES, CIVITAI_MODELS, URL_VALIDATION
  status      SyncStatus @default(PENDING)
  
  // Job details
  totalItems  Int?
  processedItems Int @default(0)
  successItems   Int @default(0)
  failedItems    Int @default(0)
  
  // Results
  results     String @default("{}") // JSON object with detailed results
  errorLog    String?
  
  // Timestamps
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime @default(now())
  
  @@map("sync_jobs")
}

model UrlValidation {
  id           String   @id @default(cuid())
  url          String   @unique
  lastChecked  DateTime @default(now())
  isValid      Boolean
  statusCode   Int?
  errorMessage String?
  
  // Track what uses this URL
  modelId      String?
  customNodeId String?
  
  @@map("url_validations")
}

// ================================
// ANALYTICS & USAGE
// ================================

model DeploymentUsage {
  id           String   @id @default(cuid())
  deploymentId String
  
  // Usage tracking
  generatedAt  DateTime @default(now())
  scriptType   String   // runpod, docker, etc.
  userAgent    String?
  ipAddress    String?
  
  @@map("deployment_usage")
}

model ModelDownloadStats {
  id          String   @id @default(cuid())
  modelId     String
  
  // Stats
  downloadCount Int @default(0)
  lastDownload DateTime?
  
  // Relations (optional foreign key for cleanup)
  model       Model? @relation(fields: [modelId], references: [id], onDelete: SetNull)
  
  @@unique([modelId])
  @@map("model_download_stats")
}

// ================================
// ENUMS
// ================================

enum Role {
  ADMIN     // Full system access
  CURATOR   // Can manage content (models, nodes)
  USER      // Can create deployments
}

enum Service {
  CIVITAI
  HUGGINGFACE
}

enum Source {
  CIVITAI      // From CivitAI
  HUGGINGFACE  // From HuggingFace
  DIRECT       // Direct URL
  GITHUB       // GitHub releases
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
  T2I_ADAPTER
  IPADAPTER
  PREPROCESSOR
  OTHER
}

enum PackageType {
  APT
  PIP
}

enum SyncType {
  COMFYUI_NODES
  CIVITAI_MODELS
  URL_VALIDATION
  HUGGINGFACE_MODELS
}

enum SyncStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

## Migration Strategy

### SQLite to PostgreSQL Migration

```sql
-- PostgreSQL-specific optimizations to add after migration

-- Indexes for performance
CREATE INDEX CONCURRENTLY idx_models_type_source ON models(type, source);
CREATE INDEX CONCURRENTLY idx_models_source_id ON models(source, source_id);
CREATE INDEX CONCURRENTLY idx_custom_nodes_github_url ON custom_nodes(github_url);
CREATE INDEX CONCURRENTLY idx_deployments_user_created ON deployments(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_deployment_models_deployment ON deployment_models(deployment_id);
CREATE INDEX CONCURRENTLY idx_deployment_nodes_deployment ON deployment_nodes(deployment_id);

-- Full-text search indexes (PostgreSQL only)
CREATE INDEX CONCURRENTLY idx_models_name_fts ON models USING gin(to_tsvector('english', name));
CREATE INDEX CONCURRENTLY idx_custom_nodes_name_fts ON custom_nodes USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- JSON indexes for metadata searching (PostgreSQL only)
CREATE INDEX CONCURRENTLY idx_models_metadata_gin ON models USING gin(metadata);
CREATE INDEX CONCURRENTLY idx_deployments_settings_gin ON deployments USING gin(custom_settings);
```

### Migration Script

```typescript
// scripts/migrate-to-postgresql.ts
import { PrismaClient as SQLiteClient } from '@prisma/client';
import { PrismaClient as PostgreSQLClient } from '@prisma/client';

const sqliteClient = new SQLiteClient({
  datasources: { db: { url: 'file:./dev.db' } }
});

const postgresClient = new PostgreSQLClient({
  datasources: { db: { url: process.env.POSTGRESQL_URL } }
});

async function migrateData() {
  console.log('Starting migration from SQLite to PostgreSQL...');
  
  // Migrate users
  const users = await sqliteClient.user.findMany();
  for (const user of users) {
    await postgresClient.user.upsert({
      where: { id: user.id },
      update: user,
      create: user
    });
  }
  
  // Migrate custom nodes
  const customNodes = await sqliteClient.customNode.findMany();
  for (const node of customNodes) {
    await postgresClient.customNode.upsert({
      where: { id: node.id },
      update: node,
      create: node
    });
  }
  
  // Continue for other tables...
  console.log('Migration completed successfully!');
}
```

## Database Utilities

### Seeding Script

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@comfyui-builder.com' },
    update: {},
    create: {
      email: 'admin@comfyui-builder.com',
      name: 'Admin User',
      role: 'ADMIN'
    }
  });

  // Create sample custom nodes
  const comfyUIManager = await prisma.customNode.upsert({
    where: { githubUrl: 'https://github.com/ltdrdata/ComfyUI-Manager' },
    update: {},
    create: {
      name: 'ComfyUI-Manager',
      githubUrl: 'https://github.com/ltdrdata/ComfyUI-Manager',
      description: 'ComfyUI extension for managing custom nodes',
      author: 'ltdrdata',
      tags: JSON.stringify(['management', 'utility']),
      isVerified: true
    }
  });

  // Create sample models
  const sdxlBase = await prisma.model.upsert({
    where: { 
      source_sourceId: {
        source: 'HUGGINGFACE',
        sourceId: 'stabilityai/stable-diffusion-xl-base-1.0'
      }
    },
    update: {},
    create: {
      source: 'HUGGINGFACE',
      sourceId: 'stabilityai/stable-diffusion-xl-base-1.0',
      name: 'SDXL Base 1.0',
      type: 'CHECKPOINT',
      baseModel: 'SDXL',
      downloadUrl: 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors',
      isVerified: true,
      metadata: JSON.stringify({
        description: 'Official SDXL base model from Stability AI',
        resolution: '1024x1024',
        fileSize: '6.94 GB'
      })
    }
  });

  console.log('Database seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Validation Utilities

```typescript
// lib/db-validators.ts
import { z } from 'zod';

export const metadataSchema = z.object({
  description: z.string().optional(),
  preview_images: z.array(z.string().url()).optional(),
  file_size: z.string().optional(),
  resolution: z.string().optional(),
  base_model: z.string().optional(),
  tags: z.array(z.string()).optional(),
  stats: z.object({
    downloads: z.number().optional(),
    likes: z.number().optional(),
    rating: z.number().optional()
  }).optional()
});

export const customSettingsSchema = z.object({
  workspace_path: z.string().optional(),
  python_version: z.string().optional(),
  cuda_version: z.string().optional(),
  custom_pip_index: z.string().url().optional(),
  environment_name: z.string().optional()
});

export function validateModelMetadata(metadata: unknown) {
  return metadataSchema.safeParse(metadata);
}

export function validateCustomSettings(settings: unknown) {
  return customSettingsSchema.safeParse(settings);
}
```

## Performance Considerations

### Database Connection Pool

```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

### Query Optimization Examples

```typescript
// Efficient pagination
export async function getDeployments(
  userId: string,
  page: number = 1,
  limit: number = 10
) {
  const skip = (page - 1) * limit;
  
  const [deployments, total] = await Promise.all([
    db.deployment.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            deploymentNodes: true,
            deploymentModels: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    db.deployment.count({ where: { userId } })
  ]);
  
  return {
    deployments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

// Efficient model search with filters
export async function searchModels(params: {
  query?: string;
  type?: ModelType;
  source?: Source;
  page?: number;
  limit?: number;
}) {
  const { query, type, source, page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;
  
  const where: any = {
    isActive: true
  };
  
  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } }
    ];
  }
  
  if (type) where.type = type;
  if (source) where.source = source;
  
  return db.model.findMany({
    where,
    include: {
      _count: {
        select: { deploymentModels: true }
      }
    },
    orderBy: [
      { isVerified: 'desc' },
      { createdAt: 'desc' }
    ],
    skip,
    take: limit
  });
}
```

This database schema provides a solid foundation for the ComfyUI Deployment Builder with proper relationships, indexes, and migration capabilities.