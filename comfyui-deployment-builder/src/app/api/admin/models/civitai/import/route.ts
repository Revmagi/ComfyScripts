import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createCivitAIClient } from '@/lib/clients/civitai'
import { ModelType, Source } from '@prisma/client'
import { z } from 'zod'
import { createModelSchema } from '@/lib/validations'

// Complete validation schema for CivitAI models including all database fields
const civitaiModelSchema = z.object({
  source: z.literal('CIVITAI'),
  sourceId: z.string(),
  sourceUrl: z.string().url(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  filename: z.string(),
  type: z.nativeEnum(ModelType),
  targetPath: z.string(),
  category: z.string().nullable().optional(),
  baseModel: z.string().nullable().optional(),
  downloadUrl: z.string().url(),
  fileSize: z.string().nullable().optional(),
  authRequired: z.boolean().default(false),
  creatorName: z.string().nullable().optional(),
  creatorUrl: z.string().nullable().optional(),
  currentVersion: z.string().optional(),
  versionName: z.string().nullable().optional(),
  allowCommercialUse: z.boolean().optional(),
  allowDerivatives: z.boolean().optional(),
  allowDifferentLicense: z.boolean().optional(),
  creditRequired: z.boolean().optional(),
  metadata: z.string().default('{}'), // JSON string, not object
  isActive: z.boolean().default(true),
  isVerified: z.boolean().default(false)
})

interface ImportRequest {
  modelId: number
  versionId?: number
  targetPath?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'CURATOR'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: ImportRequest = await request.json()
    const { modelId, versionId, targetPath } = body

    if (!modelId) {
      return NextResponse.json({ error: 'Model ID is required' }, { status: 400 })
    }

    // Create CivitAI client with database token
    const civitaiClient = await createCivitAIClient()
    
    // Fetch model details from CivitAI
    const civitaiModel = await civitaiClient.getModel(modelId)
    
    if (!civitaiModel) {
      return NextResponse.json({ error: 'Model not found on CivitAI' }, { status: 404 })
    }

    // Get the specific version or latest version
    const targetVersion = versionId 
      ? civitaiModel.modelVersions.find(v => v.id === versionId)
      : civitaiModel.modelVersions[0]

    if (!targetVersion) {
      return NextResponse.json({ error: 'Model version not found' }, { status: 404 })
    }

    // Get the primary file
    const primaryFile = civitaiClient.getPrimaryFile(targetVersion)
    
    console.log('CivitAI Model Debug Info:')
    console.log('- Model ID:', modelId)
    console.log('- Target Version:', targetVersion.id)
    console.log('- Version Files:', targetVersion.files.length)
    console.log('- Primary File:', primaryFile ? {
      id: primaryFile.id,
      name: primaryFile.name,
      downloadUrl: primaryFile.downloadUrl,
      sizeKB: primaryFile.sizeKB,
      primary: primaryFile.primary
    } : 'NOT FOUND')
    
    if (!primaryFile) {
      return NextResponse.json({ error: 'No downloadable file found' }, { status: 400 })
    }

    // Check if model already exists
    const existingModel = await db.model.findFirst({
      where: {
        source: 'CIVITAI',
        sourceId: modelId.toString()
      }
    })

    if (existingModel) {
      return NextResponse.json({ 
        error: 'Model already imported',
        modelId: existingModel.id 
      }, { status: 409 })
    }

    // Map CivitAI model type to our ModelType enum
    const mapModelType = (civitaiType: string): ModelType => {
      const typeMap: Record<string, ModelType> = {
        'Checkpoint': 'CHECKPOINT',
        'LORA': 'LORA',
        'LoCon': 'LORA',
        'LoHa': 'LORA',
        'ControlNet': 'CONTROLNET',
        'TextualInversion': 'EMBEDDING',
        'Hypernetwork': 'HYPERNETWORK',
        'AestheticGradient': 'OTHER',
        'VAE': 'VAE',
        'Poses': 'OTHER',
        'Wildcards': 'OTHER',
        'Workflows': 'OTHER',
        'Other': 'OTHER'
      }
      
      return typeMap[civitaiType] || 'OTHER'
    }

    // Prepare essential metadata only
    const metadata = {
      civitai: {
        modelId: civitaiModel.id,
        versionId: targetVersion.id,
        creator: civitaiModel.creator?.username || 'Unknown'
      },
      description: targetVersion.description || civitaiModel.description || '',
      downloadUrl: primaryFile.downloadUrl,
      filename: primaryFile.name
    }

    // Determine file category for target path
    const getTargetPath = (type: ModelType, baseModel?: string): string => {
      if (targetPath) return targetPath
      
      const pathMap: Record<ModelType, string> = {
        'CHECKPOINT': 'models/checkpoints',
        'LORA': 'models/loras',
        'CONTROLNET': 'models/controlnet',
        'VAE': 'models/vae',
        'UPSCALER': 'models/upscale_models',
        'EMBEDDING': 'embeddings',
        'HYPERNETWORK': 'models/hypernetworks',
        'UNET': 'models/unet',
        'CLIP': 'models/clip',
        'T2I_ADAPTER': 'models/t2i_adapter',
        'IPADAPTER': 'models/ipadapter',
        'PREPROCESSOR': 'models/preprocessors',
        'OTHER': 'models/other'
      }
      
      return pathMap[type] || 'models/other'
    }

    const modelType = mapModelType(civitaiModel.type)

    // Prepare enhanced model data for database with installer workflow support
    const modelData = {
      source: 'CIVITAI' as Source,
      sourceId: modelId.toString(),
      sourceUrl: `https://civitai.com/models/${modelId}`,
      name: civitaiModel.name,
      description: civitaiModel.description || targetVersion.description || null,
      filename: primaryFile.name,
      type: modelType,
      targetPath: getTargetPath(modelType, targetVersion.baseModel),
      category: civitaiModel.tags?.[0] || null,
      baseModel: targetVersion.baseModel || null,
      downloadUrl: primaryFile.downloadUrl,
      fileSize: primaryFile.sizeKB ? `${(primaryFile.sizeKB / 1024 / 1024).toFixed(1)} GB` : null,
      authRequired: false,
      
      // Creator/Author information for installer workflow
      creatorName: civitaiModel.creator?.username || null,
      creatorUrl: civitaiModel.creator?.username ? `https://civitai.com/user/${civitaiModel.creator.username}` : null,
      
      // Version information for installer workflow
      currentVersion: targetVersion.id.toString(),
      versionName: targetVersion.name || null,
      
      // License information for installer workflow
      allowCommercialUse: civitaiModel.allowCommercialUse?.includes('Sell') || false,
      allowDerivatives: civitaiModel.allowDerivatives || false,
      allowDifferentLicense: civitaiModel.allowDifferentLicense || false,
      creditRequired: !civitaiModel.allowNoCredit,
      
      metadata: JSON.stringify({
        ...metadata,
        stats: civitaiModel.stats,
        tags: civitaiModel.tags,
        allVersions: civitaiModel.modelVersions.map(v => ({
          id: v.id,
          name: v.name,
          description: v.description,
          createdAt: v.createdAt,
          downloadUrl: v.files[0]?.downloadUrl,
          filename: v.files[0]?.name,
          fileSize: v.files[0]?.sizeKB ? `${(v.files[0].sizeKB / 1024 / 1024).toFixed(1)} GB` : null,
          baseModel: v.baseModel
        }))
      }),
      isActive: true,
      isVerified: primaryFile.pickleScanResult === 'Success' && primaryFile.virusScanResult === 'Success'
    }

    console.log('Final Model Data - Download URL:', modelData.downloadUrl)
    console.log('Final Model Data - Filename:', modelData.filename)
    
    // Validate the model data
    const validationResult = civitaiModelSchema.safeParse(modelData)
    
    if (!validationResult.success) {
      console.error('Model validation failed:', {
        modelData,
        errors: validationResult.error.errors
      })
      return NextResponse.json({
        error: 'Invalid model data',
        details: validationResult.error.errors,
        receivedData: modelData
      }, { status: 400 })
    }

    // Create the model in database with versions
    const createdModel = await db.model.create({
      data: {
        source: modelData.source,
        sourceId: modelData.sourceId,
        sourceUrl: modelData.sourceUrl,
        name: modelData.name,
        description: modelData.description,
        filename: modelData.filename,
        type: modelData.type,
        targetPath: modelData.targetPath,
        category: modelData.category,
        baseModel: modelData.baseModel,
        downloadUrl: modelData.downloadUrl,
        fileSize: modelData.fileSize,
        authRequired: modelData.authRequired,
        creatorName: modelData.creatorName,
        creatorUrl: modelData.creatorUrl,
        currentVersion: modelData.currentVersion,
        versionName: modelData.versionName,
        allowCommercialUse: modelData.allowCommercialUse,
        allowDerivatives: modelData.allowDerivatives,
        allowDifferentLicense: modelData.allowDifferentLicense,
        creditRequired: modelData.creditRequired,
        metadata: modelData.metadata,
        isActive: modelData.isActive,
        isVerified: modelData.isVerified,
        
        // Create model versions
        versions: {
          create: civitaiModel.modelVersions.map((version, index) => ({
            versionId: version.id.toString(),
            name: version.name,
            description: version.description,
            downloadUrl: version.files[0]?.downloadUrl || '',
            filename: version.files[0]?.name,
            fileSize: version.files[0]?.sizeKB ? `${(version.files[0].sizeKB / 1024 / 1024).toFixed(1)} GB` : null,
            fileHash: version.files[0]?.hashes?.SHA256,
            isLatest: index === 0, // First version is latest
            releaseNotes: version.description,
            releasedAt: new Date(version.createdAt)
          }))
        }
      },
      include: {
        versions: true,
        _count: {
          select: {
            deploymentModels: true
          }
        }
      }
    })

    // Create download stats record
    await db.modelDownloadStats.create({
      data: {
        modelId: createdModel.id,
        downloadCount: 0
      }
    })

    // Transform response with enhanced data for installer workflow
    const parsedMetadata = JSON.parse(createdModel.metadata)
    const responseModel = {
      id: createdModel.id,
      name: createdModel.name,
      description: createdModel.description,
      filename: createdModel.filename,
      downloadUrl: createdModel.downloadUrl,
      type: createdModel.type,
      source: createdModel.source,
      sourceId: createdModel.sourceId,
      sourceUrl: createdModel.sourceUrl,
      fileSize: createdModel.fileSize,
      targetPath: createdModel.targetPath,
      category: createdModel.category,
      baseModel: createdModel.baseModel,
      
      // Creator information for installer workflow
      creatorName: createdModel.creatorName,
      creatorUrl: createdModel.creatorUrl,
      
      // Version information for installer workflow
      currentVersion: createdModel.currentVersion,
      versionName: createdModel.versionName,
      versionsCount: createdModel.versions.length,
      
      // License information for installer workflow
      license: {
        allowCommercialUse: createdModel.allowCommercialUse,
        allowDerivatives: createdModel.allowDerivatives,
        allowDifferentLicense: createdModel.allowDifferentLicense,
        creditRequired: createdModel.creditRequired
      },
      
      isActive: createdModel.isActive,
      isVerified: createdModel.isVerified,
      createdAt: createdModel.createdAt.toISOString()
    }

    return NextResponse.json(responseModel, { status: 201 })
  } catch (error) {
    console.error('Error importing CivitAI model:', error)
    
    if (error instanceof Error && error.message.includes('CivitAI API')) {
      return NextResponse.json({
        error: 'Failed to fetch model from CivitAI',
        details: error.message
      }, { status: 502 })
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get import status and history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'CURATOR'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Get imported CivitAI models
    const [models, total] = await Promise.all([
      db.model.findMany({
        where: {
          source: 'CIVITAI'
        },
        include: {
          downloadStats: true,
          _count: {
            select: {
              deploymentModels: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.model.count({
        where: {
          source: 'CIVITAI'
        }
      })
    ])

    // Transform models for response
    const transformedModels = models.map(model => {
      const metadata = JSON.parse(model.metadata)
      
      return {
        id: model.id,
        name: model.name,
        type: model.type,
        sourceId: model.sourceId,
        sourceUrl: model.sourceUrl,
        filename: model.filename,
        baseModel: model.baseModel,
        fileSize: model.fileSize?.toString(),
        isActive: model.isActive,
        isVerified: model.isVerified,
        createdAt: model.createdAt.toISOString(),
        downloadCount: model.downloadStats?.downloadCount || 0,
        deploymentCount: model._count.deploymentModels,
        civitai: {
          creator: metadata.civitai?.creator,
          originalStats: metadata.civitai?.stats,
          tags: metadata.civitai?.tags || []
        }
      }
    })

    return NextResponse.json({
      models: transformedModels,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching imported models:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}