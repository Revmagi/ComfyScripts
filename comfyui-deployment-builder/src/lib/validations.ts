import { z } from 'zod'
import { Role, Source, ModelType, PackageType } from '@prisma/client'

// User validation schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').optional(),
  role: z.nativeEnum(Role),
  isActive: z.boolean().default(true)
})

export const updateUserSchema = createUserSchema.partial()

// Custom Node validation schemas
export const createCustomNodeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  githubUrl: z.string().url('Invalid GitHub URL'),
  branch: z.string().min(1, 'Branch is required').default('main'),
  description: z.string().optional(),
  author: z.string().optional(),
  installType: z.string().default('git'),
  pipRequirements: z.array(z.string()).default([]),
  jsFiles: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  nodeClasses: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  isVerified: z.boolean().default(false)
})

export const updateCustomNodeSchema = createCustomNodeSchema.partial()

// Model validation schemas
export const createModelSchema = z.object({
  source: z.nativeEnum(Source),
  sourceId: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  name: z.string().min(1, 'Name is required'),
  filename: z.string().optional(),
  type: z.nativeEnum(ModelType),
  targetPath: z.string().optional(),
  category: z.string().optional(),
  baseModel: z.string().optional(),
  downloadUrl: z.string().url('Invalid download URL'),
  fileSize: z.string().optional(),
  authRequired: z.boolean().default(false),
  metadata: z.record(z.any()).default({}),
  isActive: z.boolean().default(true),
  isVerified: z.boolean().default(false)
})

export const updateModelSchema = createModelSchema.partial()

// Deployment validation schemas
export const createDeploymentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  isTemplate: z.boolean().default(false),
  isPublic: z.boolean().default(false),
  templateCategory: z.string().optional(),
  scriptType: z.string().default('runpod'),
  environmentVars: z.record(z.string()).default({}),
  customSettings: z.record(z.any()).default({})
})

export const updateDeploymentSchema = createDeploymentSchema.partial()

// System Package validation schema
export const createSystemPackageSchema = z.object({
  deploymentId: z.string().cuid(),
  packageType: z.nativeEnum(PackageType),
  name: z.string().min(1, 'Package name is required'),
  version: z.string().optional(),
  installUrl: z.string().url().optional()
})

// API Token validation schema
export const createApiTokenSchema = z.object({
  name: z.string().min(1, 'Token name is required'),
  service: z.enum(['CIVITAI', 'HUGGINGFACE']),
  token: z.string().min(1, 'Token value is required')
})

// Bulk import validation schemas
export const bulkImportNodesSchema = z.object({
  nodes: z.array(createCustomNodeSchema),
  overwriteExisting: z.boolean().default(false)
})

export const bulkImportModelsSchema = z.object({
  models: z.array(createModelSchema),
  overwriteExisting: z.boolean().default(false)
})

// Search and filter schemas
export const searchNodesSchema = z.object({
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  author: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10)
})

export const searchModelsSchema = z.object({
  query: z.string().optional(),
  type: z.nativeEnum(ModelType).optional(),
  source: z.nativeEnum(Source).optional(),
  category: z.string().optional(),
  baseModel: z.string().optional(),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10)
})

export const searchUsersSchema = z.object({
  query: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10)
})

// Metadata validation schemas
export const modelMetadataSchema = z.object({
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
  }).optional(),
  version_info: z.object({
    version: z.string().optional(),
    changelog: z.string().optional(),
    release_date: z.string().optional()
  }).optional()
})

export const customSettingsSchema = z.object({
  workspace_path: z.string().optional(),
  python_version: z.string().optional(),
  cuda_version: z.string().optional(),
  custom_pip_index: z.string().url().optional(),
  environment_name: z.string().optional(),
  memory_limit: z.string().optional(),
  gpu_memory_fraction: z.number().min(0).max(1).optional(),
  enable_optimization: z.boolean().optional(),
  debug_mode: z.boolean().optional()
})

// Environment variables validation
export const environmentVarsSchema = z.record(z.string())

// URL validation schema
export const urlValidationSchema = z.object({
  url: z.string().url('Invalid URL'),
  timeout: z.number().min(1000).max(30000).default(10000),
  follow_redirects: z.boolean().default(true)
})

// Export type inference
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type CreateCustomNodeInput = z.infer<typeof createCustomNodeSchema>
export type UpdateCustomNodeInput = z.infer<typeof updateCustomNodeSchema>
export type CreateModelInput = z.infer<typeof createModelSchema>
export type UpdateModelInput = z.infer<typeof updateModelSchema>
export type CreateDeploymentInput = z.infer<typeof createDeploymentSchema>
export type UpdateDeploymentInput = z.infer<typeof updateDeploymentSchema>
export type CreateSystemPackageInput = z.infer<typeof createSystemPackageSchema>
export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>
export type SearchNodesInput = z.infer<typeof searchNodesSchema>
export type SearchModelsInput = z.infer<typeof searchModelsSchema>
export type SearchUsersInput = z.infer<typeof searchUsersSchema>
export type ModelMetadata = z.infer<typeof modelMetadataSchema>
export type CustomSettings = z.infer<typeof customSettingsSchema>

// Validation helper functions
export function validateModelMetadata(metadata: unknown) {
  return modelMetadataSchema.safeParse(metadata)
}

export function validateCustomSettings(settings: unknown) {
  return customSettingsSchema.safeParse(settings)
}

export function validateEnvironmentVars(vars: unknown) {
  return environmentVarsSchema.safeParse(vars)
}

// Form validation with better error messages
export const getFieldError = (errors: any, field: string): string | undefined => {
  return errors?.[field]?.message
}