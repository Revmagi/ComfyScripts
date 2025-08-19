import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { updateModelSchema } from '@/lib/validations'
import { ModelType, Source } from '@prisma/client'

interface Params {
  params: {
    id: string
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const model = await db.model.findUnique({
      where: { id },
      include: {
        downloadStats: true,
        _count: {
          select: {
            deploymentModels: true
          }
        },
        deploymentModels: {
          include: {
            deployment: {
              select: {
                id: true,
                name: true,
                createdAt: true,
                user: {
                  select: {
                    email: true,
                    name: true
                  }
                }
              }
            }
          },
          take: 5,
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 })
    }

    // Transform response
    const transformedModel = {
      id: model.id,
      name: model.name,
      type: model.type,
      source: model.source,
      sourceId: model.sourceId,
      sourceUrl: model.sourceUrl,
      targetPath: model.targetPath,
      baseModel: model.baseModel,
      downloadUrl: model.downloadUrl,
      fileSize: model.fileSize ? formatFileSize(Number(model.fileSize)) : null,
      authRequired: model.authRequired,
      isActive: model.isActive,
      isVerified: model.isVerified,
      lastValidated: model.lastValidated?.toISOString() || null,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString(),
      downloadCount: model.downloadStats?.downloadCount || 0,
      deploymentCount: model._count.deploymentModels,
      metadata: JSON.parse(model.metadata),
      recentDeployments: model.deploymentModels.map(dm => ({
        id: dm.deployment.id,
        name: dm.deployment.name,
        createdAt: dm.deployment.createdAt.toISOString(),
        targetPath: dm.targetPath,
        user: dm.deployment.user
      }))
    }

    return NextResponse.json(transformedModel)
  } catch (error) {
    console.error('Error fetching model:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    
    // Validate input
    const validationResult = updateModelSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const updateData = validationResult.data

    // Check if model exists
    const existingModel = await db.model.findUnique({
      where: { id }
    })

    if (!existingModel) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 })
    }

    // Check if download URL is being changed and if it conflicts
    if (updateData.downloadUrl && updateData.downloadUrl !== existingModel.downloadUrl) {
      const urlConflict = await db.model.findFirst({
        where: { downloadUrl: updateData.downloadUrl }
      })

      if (urlConflict) {
        return NextResponse.json(
          { error: 'Model with this download URL already exists' },
          { status: 409 }
        )
      }
    }

    // Prepare update data with JSON serialization for metadata
    const dbUpdateData: any = { ...updateData }
    if (updateData.metadata) {
      dbUpdateData.metadata = JSON.stringify(updateData.metadata)
    }

    // Update model
    const model = await db.model.update({
      where: { id },
      data: dbUpdateData,
      include: {
        downloadStats: true,
        _count: {
          select: {
            deploymentModels: true
          }
        }
      }
    })

    // Transform response
    const transformedModel = {
      id: model.id,
      name: model.name,
      type: model.type,
      source: model.source,
      sourceId: model.sourceId,
      sourceUrl: model.sourceUrl,
      targetPath: model.targetPath,
      baseModel: model.baseModel,
      downloadUrl: model.downloadUrl,
      fileSize: model.fileSize ? formatFileSize(Number(model.fileSize)) : null,
      authRequired: model.authRequired,
      isActive: model.isActive,
      isVerified: model.isVerified,
      lastValidated: model.lastValidated?.toISOString() || null,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString(),
      downloadCount: model.downloadStats?.downloadCount || 0,
      deploymentCount: model._count.deploymentModels,
      metadata: JSON.parse(model.metadata)
    }

    return NextResponse.json(transformedModel)
  } catch (error) {
    console.error('Error updating model:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    
    // Check if model exists
    const existingModel = await db.model.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            deploymentModels: true
          }
        }
      }
    })

    if (!existingModel) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 })
    }

    // Check if model is being used in deployments
    if (existingModel._count.deploymentModels > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete model that is being used in deployments',
          details: `Model is used in ${existingModel._count.deploymentModels} deployment(s)`
        },
        { status: 400 }
      )
    }

    // Delete model (cascading deletes will handle related records)
    await db.model.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Model deleted successfully' })
  } catch (error) {
    console.error('Error deleting model:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Validate model URL endpoint
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const model = await db.model.findUnique({
      where: { id }
    })

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 })
    }

    // Perform actual URL validation based on model source
    let isValid = false
    let validationMessage = 'URL validation failed'
    
    try {
      if (model.source === 'CIVITAI') {
        // For CivitAI models, validate the download URL
        console.log(`Validating CivitAI URL: ${model.downloadUrl}`)
        
        const response = await fetch(model.downloadUrl, {
          method: 'HEAD', // Use HEAD to check if URL exists without downloading
          headers: {
            'User-Agent': 'ComfyUI-Deployment-Builder/1.0'
          }
        })
        
        console.log(`CivitAI URL validation response: ${response.status}`)
        
        if (response.ok) {
          isValid = true
          validationMessage = 'Download URL is accessible'
        } else if (response.status === 404) {
          validationMessage = 'Download URL not found (404)'
        } else if (response.status === 401 || response.status === 403) {
          validationMessage = 'Download URL requires authentication'
        } else {
          validationMessage = `Download URL returned ${response.status}`
        }
      } else if (model.source === 'HUGGINGFACE') {
        // For HuggingFace models, validate the download URL
        console.log(`Validating HuggingFace URL: ${model.downloadUrl}`)
        
        const response = await fetch(model.downloadUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'ComfyUI-Deployment-Builder/1.0'
          }
        })
        
        console.log(`HuggingFace URL validation response: ${response.status}`)
        
        if (response.ok) {
          isValid = true
          validationMessage = 'Download URL is accessible'
        } else {
          validationMessage = `Download URL returned ${response.status}`
        }
      } else {
        // For other sources, try basic URL validation
        console.log(`Validating generic URL: ${model.downloadUrl}`)
        
        const response = await fetch(model.downloadUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'ComfyUI-Deployment-Builder/1.0'
          }
        })
        
        isValid = response.ok
        validationMessage = isValid ? 'Download URL is accessible' : `Download URL returned ${response.status}`
      }
    } catch (error) {
      console.error('URL validation error:', error)
      validationMessage = `URL validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      isValid = false
    }

    // Update validation status
    const updatedModel = await db.model.update({
      where: { id },
      data: {
        lastValidated: new Date(),
        isVerified: isValid
      },
      include: {
        downloadStats: true,
        _count: {
          select: {
            deploymentModels: true
          }
        }
      }
    })

    // Transform response
    const transformedModel = {
      id: updatedModel.id,
      name: updatedModel.name,
      type: updatedModel.type,
      source: updatedModel.source,
      targetPath: updatedModel.targetPath,
      baseModel: updatedModel.baseModel,
      downloadUrl: updatedModel.downloadUrl,
      fileSize: updatedModel.fileSize ? formatFileSize(Number(updatedModel.fileSize)) : null,
      isActive: updatedModel.isActive,
      isVerified: updatedModel.isVerified,
      createdAt: updatedModel.createdAt.toISOString(),
      lastValidated: updatedModel.lastValidated?.toISOString() || null,
      downloadCount: updatedModel.downloadStats?.downloadCount || 0,
      deploymentCount: updatedModel._count.deploymentModels,
      validationResult: {
        isValid,
        message: validationMessage
      }
    }

    return NextResponse.json(transformedModel)
  } catch (error) {
    console.error('Error validating model:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return 'Unknown'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}