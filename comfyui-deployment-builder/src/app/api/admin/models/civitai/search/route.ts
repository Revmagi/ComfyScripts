import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCivitAIClient } from '@/lib/clients/civitai'
import type { CivitAISearchParams } from '@/lib/clients/civitai'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'CURATOR'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    
    // Parse search parameters
    const queryParam = searchParams.get('query')
    const hasQuery = queryParam && queryParam.trim().length > 0
    const cursor = searchParams.get('cursor')
    const civitaiParams: CivitAISearchParams = {
      limit: parseInt(searchParams.get('limit') || '50'), // Balanced for performance
      // CivitAI uses cursor-based pagination - if cursor is provided, don't use page
      page: cursor ? undefined : (hasQuery ? undefined : parseInt(searchParams.get('page') || '1')),
      cursor: cursor || undefined,
      query: hasQuery ? queryParam : undefined,
      tag: searchParams.get('tag') || undefined,
      username: searchParams.get('username') || undefined,
      types: searchParams.getAll('types').length > 0 ? searchParams.getAll('types') : undefined,
      sort: (searchParams.get('sort') as any) || 'Highest Rated',
      period: (searchParams.get('period') as any) || 'Month',
      rating: searchParams.get('rating') ? parseInt(searchParams.get('rating')!) : undefined,
      favorites: searchParams.get('favorites') === 'true',
      hidden: searchParams.get('hidden') === 'true',
      primaryFileOnly: searchParams.get('primaryFileOnly') === 'true',
      allowNoCredit: searchParams.has('allowNoCredit') ? searchParams.get('allowNoCredit') === 'true' : undefined,
      allowDerivatives: searchParams.has('allowDerivatives') ? searchParams.get('allowDerivatives') === 'true' : undefined,
      allowDifferentLicenses: searchParams.has('allowDifferentLicenses') ? searchParams.get('allowDifferentLicenses') === 'true' : undefined,
      allowCommercialUse: searchParams.getAll('allowCommercialUse').length > 0 ? searchParams.getAll('allowCommercialUse') : undefined,
      nsfw: searchParams.get('nsfw') === 'true',
      supportsGeneration: searchParams.get('supportsGeneration') === 'true',
      baseModels: searchParams.getAll('baseModels').length > 0 ? searchParams.getAll('baseModels') : undefined
    }

    // Validate parameters
    if (civitaiParams.limit && (civitaiParams.limit < 1 || civitaiParams.limit > 200)) {
      return NextResponse.json({ error: 'Limit must be between 1 and 200' }, { status: 400 })
    }

    if (civitaiParams.page && civitaiParams.page < 1) {
      return NextResponse.json({ error: 'Page must be greater than 0' }, { status: 400 })
    }

    // Create CivitAI client with database token
    const civitaiClient = await createCivitAIClient()
    
    // Search models using CivitAI client
    const searchResults = await civitaiClient.searchModels(civitaiParams)

    // Transform the response to include additional metadata
    const transformedResults = {
      items: searchResults.items.map(model => ({
        ...model,
        // Add safety information
        safety: {
          isNSFW: model.nsfw,
          isPOI: model.poi,
          isSafe: civitaiClient.isModelSafe(model)
        },
        // Add convenience fields
        thumbnail: civitaiClient.getModelThumbnail(model),
        primaryFile: model.modelVersions[0] ? civitaiClient.getPrimaryFile(model.modelVersions[0]) : null,
        formattedFileSize: model.modelVersions[0]?.files[0] ? civitaiClient.formatFileSize(model.modelVersions[0].files[0].sizeKB) : null,
        // Add license summary
        licenseSummary: {
          commercialUse: model.allowCommercialUse.length > 0,
          creditRequired: !model.allowNoCredit,
          derivativesAllowed: model.allowDerivatives,
          differentLicenseAllowed: model.allowDifferentLicense
        }
      })),
      metadata: searchResults.metadata,
      // Add search metadata
      searchInfo: {
        query: civitaiParams.query,
        filters: {
          types: civitaiParams.types,
          baseModels: civitaiParams.baseModels,
          sort: civitaiParams.sort,
          period: civitaiParams.period,
          nsfw: civitaiParams.nsfw
        },
        timestamp: new Date().toISOString()
      }
    }

    return NextResponse.json(transformedResults)
  } catch (error) {
    console.error('Error searching CivitAI models:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('CivitAI API error')) {
        return NextResponse.json({
          error: 'CivitAI service error',
          details: error.message
        }, { status: 502 })
      }
      
      if (error.message.includes('rate limit')) {
        return NextResponse.json({
          error: 'Rate limit exceeded',
          details: 'Too many requests to CivitAI. Please try again later.'
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
    const { action, type, period } = body

    // Create CivitAI client with database token
    const civitaiClient = await createCivitAIClient()

    let results

    switch (action) {
      case 'popular':
        results = await civitaiClient.getPopularModels(type, period)
        break
      case 'checkpoints':
        results = await civitaiClient.searchCheckpoints(undefined, type) // type as baseModel
        break
      case 'loras':
        results = await civitaiClient.searchLORAs(undefined, type) // type as baseModel
        break
      case 'controlnets':
        results = await civitaiClient.searchControlNets()
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Transform results similar to GET endpoint
    const transformedResults = {
      items: results.items.map(model => ({
        ...model,
        safety: {
          isNSFW: model.nsfw,
          isPOI: model.poi,
          isSafe: civitaiClient.isModelSafe(model)
        },
        thumbnail: civitaiClient.getModelThumbnail(model),
        primaryFile: model.modelVersions[0] ? civitaiClient.getPrimaryFile(model.modelVersions[0]) : null,
        formattedFileSize: model.modelVersions[0]?.files[0] ? civitaiClient.formatFileSize(model.modelVersions[0].files[0].sizeKB) : null,
        licenseSummary: {
          commercialUse: model.allowCommercialUse.length > 0,
          creditRequired: !model.allowNoCredit,
          derivativesAllowed: model.allowDerivatives,
          differentLicenseAllowed: model.allowDifferentLicense
        }
      })),
      metadata: results.metadata,
      searchInfo: {
        action,
        type,
        period,
        timestamp: new Date().toISOString()
      }
    }

    return NextResponse.json(transformedResults)
  } catch (error) {
    console.error('Error fetching CivitAI models:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}