import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createModelSchema, searchModelsSchema } from '@/lib/validations'
import { ModelType, Source } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || undefined
    const typeParam = searchParams.get('type')
    const sourceParam = searchParams.get('source')
    const isActive = searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined
    const isVerified = searchParams.get('isVerified') ? searchParams.get('isVerified') === 'true' : undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    // Only pass valid enum values
    const type = typeParam && Object.values(ModelType).includes(typeParam as ModelType) ? typeParam as ModelType : undefined
    const source = sourceParam && Object.values(Source).includes(sourceParam as Source) ? sourceParam as Source : undefined

    // Validate search parameters
    const validationResult = searchModelsSchema.safeParse({
      query,
      type,
      source,
      isActive,
      isVerified,
      page,
      limit
    })

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid search parameters', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { query: searchQuery, type: filterType, source: filterSource, isActive: filterActive, isVerified: filterVerified } = validationResult.data
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (searchQuery) {
      where.OR = [
        { name: { contains: searchQuery } },
        { baseModel: { contains: searchQuery } }
      ]
    }
    
    if (filterType) {
      where.type = filterType
    }
    
    if (filterSource) {
      where.source = filterSource
    }
    
    if (filterActive !== undefined) {
      where.isActive = filterActive
    }
    
    if (filterVerified !== undefined) {
      where.isVerified = filterVerified
    }

    // Get models with download stats
    const [models, total] = await Promise.all([
      db.model.findMany({
        where,
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
      db.model.count({ where })
    ])

    // Transform data for response
    const transformedModels = models.map(model => ({
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
      isActive: model.isActive,
      isVerified: model.isVerified,
      createdAt: model.createdAt.toISOString(),
      lastValidated: model.lastValidated?.toISOString() || null,
      downloadCount: model.downloadStats?.downloadCount || 0,
      deploymentCount: model._count.deploymentModels,
      metadata: JSON.parse(model.metadata)
    }))

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
    console.error('Error fetching models:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate input
    const validationResult = createModelSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const modelData = validationResult.data

    // Check if model already exists
    const existingModel = await db.model.findFirst({
      where: { 
        OR: [
          { downloadUrl: modelData.downloadUrl },
          { 
            AND: [
              { name: modelData.name },
              { type: modelData.type }
            ]
          }
        ]
      }
    })

    if (existingModel) {
      return NextResponse.json(
        { error: 'Model with this name/URL already exists' },
        { status: 409 }
      )
    }

    // Create model
    const model = await db.model.create({
      data: {
        name: modelData.name,
        type: modelData.type,
        source: modelData.source,
        downloadUrl: modelData.downloadUrl,
        targetPath: modelData.targetPath,
        baseModel: modelData.baseModel,
        fileSize: modelData.fileSize,
        authRequired: modelData.authRequired,
        isActive: modelData.isActive,
        isVerified: modelData.isVerified,
        metadata: JSON.stringify(modelData.metadata)
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
      isActive: model.isActive,
      isVerified: model.isVerified,
      createdAt: model.createdAt.toISOString(),
      lastValidated: model.lastValidated?.toISOString() || null,
      downloadCount: model.downloadStats?.downloadCount || 0,
      deploymentCount: model._count.deploymentModels,
      metadata: JSON.parse(model.metadata)
    }

    return NextResponse.json(transformedModel, { status: 201 })
  } catch (error) {
    console.error('Error creating model:', error)
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