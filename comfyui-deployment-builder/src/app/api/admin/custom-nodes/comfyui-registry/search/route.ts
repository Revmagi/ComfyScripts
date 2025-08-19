import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createComfyUIRegistryClient } from '@/lib/clients/comfyui-registry'
import type { ComfyUIRegistrySearchParams } from '@/lib/clients/comfyui-registry'

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
    
    const registryParams: ComfyUIRegistrySearchParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100), // Cap at 100
      search: hasQuery ? queryParam : undefined,
      include_banned: searchParams.get('include_banned') === 'true'
    }

    // Validate parameters
    if (registryParams.page && registryParams.page < 1) {
      return NextResponse.json({ error: 'Page must be greater than 0' }, { status: 400 })
    }

    if (registryParams.limit && (registryParams.limit < 1 || registryParams.limit > 100)) {
      return NextResponse.json({ error: 'Limit must be between 1 and 100' }, { status: 400 })
    }

    // Create ComfyUI Registry client
    const registryClient = await createComfyUIRegistryClient()
    
    // Search nodes using ComfyUI Registry client
    let searchResults
    if (hasQuery) {
      searchResults = await registryClient.searchNodes(registryParams)
    } else {
      searchResults = await registryClient.listNodes({
        page: registryParams.page,
        limit: registryParams.limit,
        include_banned: registryParams.include_banned,
        latest: true
      })
    }

    // Transform the response to include additional metadata
    const transformedResults = {
      nodes: searchResults.nodes.map(node => ({
        ...node,
        // Add convenience fields
        githubUrl: registryClient.extractGitHubUrl(node.repository),
        isSafe: registryClient.isNodeSafe(node),
        tags: registryClient.getNodeTags(node),
        latestVersion: registryClient.getLatestVersion(node),
        // Format for frontend display
        displayName: node.name,
        categoryDisplay: node.category || 'Uncategorized',
        authorDisplay: node.author || node.publisher?.name || 'Unknown',
        descriptionPreview: node.description ? 
          (node.description.length > 200 ? 
            node.description.substring(0, 197) + '...' : 
            node.description) : 
          'No description available'
      })),
      pagination: {
        page: searchResults.page,
        limit: searchResults.limit || registryParams.limit,
        total: searchResults.total,
        hasMore: searchResults.has_more
      },
      // Add search metadata
      searchInfo: {
        query: registryParams.search,
        includeBanned: registryParams.include_banned,
        timestamp: new Date().toISOString()
      }
    }

    return NextResponse.json(transformedResults)
  } catch (error) {
    console.error('Error searching ComfyUI Registry nodes:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('ComfyUI Registry API error')) {
        return NextResponse.json({
          error: 'ComfyUI Registry service error',
          details: error.message
        }, { status: 502 })
      }
      
      if (error.message.includes('rate limit')) {
        return NextResponse.json({
          error: 'Rate limit exceeded',
          details: 'Too many requests to ComfyUI Registry. Please try again later.'
        }, { status: 429 })
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get popular/trending nodes
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'CURATOR'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, category, limit } = body

    // Create ComfyUI Registry client
    const registryClient = await createComfyUIRegistryClient()

    let results
    
    switch (action) {
      case 'popular':
        results = await registryClient.getPopularNodes(limit || 20)
        break
      case 'category':
        if (!category) {
          return NextResponse.json({ error: 'Category is required for category action' }, { status: 400 })
        }
        results = await registryClient.getNodesByCategory(category, limit || 20)
        break
      default:
        return NextResponse.json({ error: 'Invalid action. Use "popular" or "category"' }, { status: 400 })
    }

    // Transform results similar to GET endpoint
    const transformedResults = {
      nodes: results.nodes.map(node => ({
        ...node,
        githubUrl: registryClient.extractGitHubUrl(node.repository),
        isSafe: registryClient.isNodeSafe(node),
        tags: registryClient.getNodeTags(node),
        latestVersion: registryClient.getLatestVersion(node),
        displayName: node.name,
        categoryDisplay: node.category || 'Uncategorized',
        authorDisplay: node.author || node.publisher?.name || 'Unknown',
        descriptionPreview: node.description ? 
          (node.description.length > 200 ? 
            node.description.substring(0, 197) + '...' : 
            node.description) : 
          'No description available'
      })),
      pagination: {
        page: results.page,
        limit: results.limit,
        total: results.total,
        hasMore: results.has_more
      },
      searchInfo: {
        action,
        category,
        limit,
        timestamp: new Date().toISOString()
      }
    }

    return NextResponse.json(transformedResults)
  } catch (error) {
    console.error('Error fetching ComfyUI Registry nodes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}