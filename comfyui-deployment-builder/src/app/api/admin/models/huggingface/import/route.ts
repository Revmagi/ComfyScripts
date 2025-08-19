import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createHuggingFaceClient } from '@/lib/clients/huggingface'
import { ModelType, Source } from '@prisma/client'

interface ImportRequest {
  modelId: string
  filename?: string
  targetPath?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'CURATOR'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: ImportRequest = await request.json()
    const { modelId, filename, targetPath } = body

    if (!modelId) {
      return NextResponse.json({ error: 'Model ID is required' }, { status: 400 })
    }

    // Create HuggingFace client with database token
    const hfClient = await createHuggingFaceClient()
    
    // Fetch model details from HuggingFace
    const hfModel = await hfClient.getModel(modelId)
    
    if (!hfModel) {
      return NextResponse.json({ error: 'Model not found on HuggingFace' }, { status: 404 })
    }

    // Check if model already exists
    const existingModel = await db.model.findFirst({
      where: {
        source: 'HUGGINGFACE',
        sourceId: modelId
      }
    })

    if (existingModel) {
      return NextResponse.json({ 
        error: 'Model already imported',
        modelId: existingModel.id 
      }, { status: 409 })
    }

    // Get the primary file or specified filename
    const primaryFile = filename 
      ? hfModel.siblings.find(f => f.rfilename === filename)
      : hfClient.getPrimaryModelFile(hfModel)
    
    if (!primaryFile) {
      return NextResponse.json({ error: 'No downloadable file found' }, { status: 400 })
    }

    // Map HuggingFace model type to our ModelType enum
    const mapModelType = (hfModelType: string): ModelType => {
      const lowerType = hfModelType.toLowerCase()
      
      if (lowerType.includes('lora')) return 'LORA'
      if (lowerType.includes('controlnet')) return 'CONTROLNET'
      if (lowerType.includes('vae')) return 'VAE'
      if (lowerType.includes('upscaler') || lowerType.includes('esrgan')) return 'UPSCALER'
      if (lowerType.includes('embedding') || lowerType.includes('textual')) return 'EMBEDDING'
      if (lowerType.includes('clip')) return 'CLIP'
      if (lowerType.includes('unet')) return 'UNET'
      
      // Check pipeline tag
      if (hfModel.pipeline_tag === 'text-to-image' || hfClient.isStableDiffusionModel(hfModel)) {
        return 'CHECKPOINT'
      }
      
      return 'OTHER'
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
        'ESRGAN': 'models/upscale_models',
        'ULTRALYTICS_BBOX': 'models/ultralytics/bbox',
        'ULTRALYTICS_SEGM': 'models/ultralytics/segm',
        'SAM': 'models/sam',
        'INSIGHTFACE': 'models/insightface',
        'CLIP_VISION': 'models/clip_vision',
        'STYLE_MODELS': 'models/style_models',
        'OTHER': 'models/other'
      }
      
      return pathMap[type] || 'models/other'
    }

    const modelType = mapModelType(hfClient.getModelType(hfModel))
    const baseModel = hfClient.getBaseModel(hfModel)

    // Get download URL for the file
    const downloadInfo = await hfClient.getDownloadInfo(modelId, primaryFile.rfilename)

    // Prepare simplified model data for database with just essential fields
    const modelData = {
      source: 'HUGGINGFACE' as Source,
      sourceId: modelId,
      sourceUrl: `https://huggingface.co/${modelId}`,
      name: hfModel.id, // Full model name (e.g., "black-forest-labs/FLUX.1-dev")
      filename: primaryFile.rfilename,
      type: modelType,
      downloadUrl: downloadInfo.downloadUrl,
      
      // Store author, tags, and additional metadata in the metadata JSON field
      metadata: JSON.stringify({
        author: hfModel.author, // Author information
        tags: hfModel.tags, // Model tags
        modelType: hfClient.getModelType(hfModel), // Type of model
        huggingface: {
          modelId: hfModel.id,
          sha: hfModel.sha,
          library: hfModel.library_name,
          pipeline_tag: hfModel.pipeline_tag,
          downloads: hfModel.downloads,
          likes: hfModel.likes
        },
        primaryFile: {
          filename: primaryFile.rfilename,
          size: primaryFile.size || primaryFile.lfs?.size,
          sha256: primaryFile.lfs?.sha256
        }
      }),
      isActive: true,
      isVerified: !hfModel.gated && !hfModel.disabled
    }

    // Create the model in database with only essential fields
    const createdModel = await db.model.create({
      data: {
        source: modelData.source,
        sourceId: modelData.sourceId,
        sourceUrl: modelData.sourceUrl,
        name: modelData.name,
        filename: modelData.filename,
        type: modelData.type,
        downloadUrl: modelData.downloadUrl,
        metadata: modelData.metadata,
        isActive: modelData.isActive,
        isVerified: modelData.isVerified
      },
      include: {
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

    // Transform response with essential data
    const parsedMetadata = JSON.parse(createdModel.metadata)
    const responseModel = {
      id: createdModel.id,
      name: createdModel.name, // Model Name
      author: parsedMetadata.author, // Author
      type: createdModel.type, // Type of Model
      tags: parsedMetadata.tags, // Tags
      downloadUrl: createdModel.downloadUrl, // Direct download URL
      
      // Additional useful information
      filename: createdModel.filename,
      source: createdModel.source,
      sourceId: createdModel.sourceId,
      sourceUrl: createdModel.sourceUrl,
      
      // HuggingFace specific info
      huggingface: {
        library: parsedMetadata.huggingface?.library,
        pipeline_tag: parsedMetadata.huggingface?.pipeline_tag,
        downloads: parsedMetadata.huggingface?.downloads,
        likes: parsedMetadata.huggingface?.likes
      },
      
      isActive: createdModel.isActive,
      isVerified: createdModel.isVerified,
      createdAt: createdModel.createdAt.toISOString()
    }

    return NextResponse.json(responseModel, { status: 201 })
  } catch (error) {
    console.error('Error importing HuggingFace model:', error)
    
    if (error instanceof Error && error.message.includes('HuggingFace API')) {
      return NextResponse.json({
        error: 'Failed to fetch model from HuggingFace',
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

    // Get imported HuggingFace models
    const [models, total] = await Promise.all([
      db.model.findMany({
        where: {
          source: 'HUGGINGFACE'
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
          source: 'HUGGINGFACE'
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
        fileSize: model.fileSize,
        isActive: model.isActive,
        isVerified: model.isVerified,
        authRequired: model.authRequired,
        createdAt: model.createdAt.toISOString(),
        downloadCount: model.downloadStats?.downloadCount || 0,
        deploymentCount: model._count.deploymentModels,
        huggingface: {
          library: metadata.huggingface?.library,
          pipeline_tag: metadata.huggingface?.pipeline_tag,
          downloads: metadata.downloads,
          likes: metadata.likes,
          author: metadata.huggingface?.author
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