import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createHuggingFaceClient } from '@/lib/clients/huggingface'
import type { HuggingFaceSearchParams } from '@/lib/clients/huggingface'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'CURATOR'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    
    // Parse search parameters
    const hfParams: HuggingFaceSearchParams = {
      search: searchParams.get('search') || undefined,
      author: searchParams.get('author') || undefined,
      filter: searchParams.get('filter') || undefined,
      sort: (searchParams.get('sort') as any) || 'downloads',
      direction: (searchParams.get('direction') as any) || 'desc',
      limit: parseInt(searchParams.get('limit') || '20'),
      page: parseInt(searchParams.get('page') || '1'),
      full: searchParams.get('full') !== 'false',
      config: searchParams.get('config') !== 'false'
    }

    // Validate parameters
    if (hfParams.limit && (hfParams.limit < 1 || hfParams.limit > 100)) {
      return NextResponse.json({ error: 'Limit must be between 1 and 100' }, { status: 400 })
    }

    // Create HuggingFace client with database token
    const hfClient = await createHuggingFaceClient()
    
    // Search models using HuggingFace client
    const searchResults = await hfClient.searchModels(hfParams)

    // Transform the response to include additional metadata
    const transformedResults = {
      models: searchResults.map(model => ({
        ...model,
        // Add convenience fields
        modelType: hfClient.getModelType(model),
        baseModel: hfClient.getBaseModel(model),
        primaryFile: hfClient.getPrimaryModelFile(model),
        formattedFileSize: model.safetensors?.total ? hfClient.formatFileSize(model.safetensors.total) : 'Unknown',
        // Add license and usage info
        license: hfClient.getModelLicense(model),
        isCommercialUseAllowed: hfClient.isCommercialUseAllowed(model),
        // Add safety information
        isStableDiffusion: hfClient.isStableDiffusionModel(model),
        requiresAuth: model.gated === true,
        // Add formatted metadata
        createdAt: model.lastModified,
        downloadUrl: model.id ? `https://huggingface.co/${model.id}` : null
      })),
      // Add search metadata
      searchInfo: {
        query: hfParams.search,
        filters: {
          author: hfParams.author,
          filter: hfParams.filter,
          sort: hfParams.sort,
          direction: hfParams.direction
        },
        total: searchResults.length,
        timestamp: new Date().toISOString()
      }
    }

    return NextResponse.json(transformedResults)
  } catch (error) {
    console.error('Error searching HuggingFace models:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('HuggingFace API error')) {
        return NextResponse.json({
          error: 'HuggingFace service error',
          details: error.message
        }, { status: 502 })
      }
      
      if (error.message.includes('rate limit')) {
        return NextResponse.json({
          error: 'Rate limit exceeded',
          details: 'Too many requests to HuggingFace. Please try again later.'
        }, { status: 429 })
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get popular/trending models
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'CURATOR'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, library, task, limit } = body

    // Create HuggingFace client with database token
    const hfClient = await createHuggingFaceClient()

    let results

    switch (action) {
      case 'trending':
        results = await hfClient.getTrendingModels(limit || 20)
        break
      case 'diffusion':
        results = await hfClient.searchDiffusionModels()
        break
      case 'transformers':
        results = await hfClient.searchTransformersModels(undefined, task)
        break
      case 'library':
        results = await hfClient.searchByLibrary(library)
        break
      case 'author':
        results = await hfClient.getModelsByAuthor(body.author, limit || 20)
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Transform results similar to GET endpoint
    const transformedResults = {
      models: results.map(model => ({
        ...model,
        modelType: hfClient.getModelType(model),
        baseModel: hfClient.getBaseModel(model),
        primaryFile: hfClient.getPrimaryModelFile(model),
        formattedFileSize: model.safetensors?.total ? hfClient.formatFileSize(model.safetensors.total) : 'Unknown',
        license: hfClient.getModelLicense(model),
        isCommercialUseAllowed: hfClient.isCommercialUseAllowed(model),
        isStableDiffusion: hfClient.isStableDiffusionModel(model),
        requiresAuth: model.gated === true,
        createdAt: model.lastModified,
        downloadUrl: model.id ? `https://huggingface.co/${model.id}` : null
      })),
      searchInfo: {
        action,
        library,
        task,
        author: body.author,
        limit,
        timestamp: new Date().toISOString()
      }
    }

    return NextResponse.json(transformedResults)
  } catch (error) {
    console.error('Error fetching HuggingFace models:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}