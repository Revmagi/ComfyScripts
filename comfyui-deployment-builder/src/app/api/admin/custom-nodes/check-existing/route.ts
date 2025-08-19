import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const checkExistingSchema = z.object({
  source: z.enum(['MANUAL', 'COMFYUI_REGISTRY']),
  nodeIds: z.array(z.string()).optional(),
  githubUrls: z.array(z.string()).optional()
}).refine(data => data.nodeIds || data.githubUrls, {
  message: "Either nodeIds or githubUrls must be provided"
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'CURATOR'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate request body
    const validationResult = checkExistingSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid request body',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const { source, nodeIds, githubUrls } = validationResult.data

    let whereClause: any = {
      source: source
    }

    // Build the query based on what identifiers were provided
    if (source === 'COMFYUI_REGISTRY' && nodeIds) {
      // For ComfyUI Registry nodes, check by registryId
      whereClause.registryId = {
        in: nodeIds
      }
    } else if (githubUrls) {
      // For GitHub URLs
      whereClause.githubUrl = {
        in: githubUrls
      }
    } else if (nodeIds && source === 'MANUAL') {
      // For manual nodes, we might check by ID or name
      whereClause.OR = [
        { id: { in: nodeIds } },
        { name: { in: nodeIds } }
      ]
    }

    console.log('Checking existing nodes:', {
      source,
      nodeIds: nodeIds?.length || 0,
      githubUrls: githubUrls?.length || 0,
      whereClause
    })

    // Query the database
    const existingNodes = await db.customNode.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        registryId: true,
        githubUrl: true,
        source: true,
        isActive: true,
        createdAt: true
      }
    })

    // Build the response mapping
    const existing: Record<string, any> = {}

    existingNodes.forEach(node => {
      // Map by registryId for ComfyUI Registry nodes
      if (node.registryId && nodeIds?.includes(node.registryId)) {
        existing[node.registryId] = {
          id: node.id,
          name: node.name,
          githubUrl: node.githubUrl,
          source: node.source,
          isActive: node.isActive,
          createdAt: node.createdAt.toISOString()
        }
      }

      // Map by GitHub URL
      if (node.githubUrl && githubUrls?.includes(node.githubUrl)) {
        existing[node.githubUrl] = {
          id: node.id,
          name: node.name,
          githubUrl: node.githubUrl,
          source: node.source,
          isActive: node.isActive,
          createdAt: node.createdAt.toISOString()
        }
      }

      // Map by ID or name for manual nodes
      if (source === 'MANUAL' && nodeIds) {
        if (nodeIds.includes(node.id) || nodeIds.includes(node.name)) {
          const key = nodeIds.includes(node.id) ? node.id : node.name
          existing[key] = {
            id: node.id,
            name: node.name,
            githubUrl: node.githubUrl,
            source: node.source,
            isActive: node.isActive,
            createdAt: node.createdAt.toISOString()
          }
        }
      }
    })

    console.log('Found existing nodes:', {
      total: existingNodes.length,
      mapped: Object.keys(existing).length
    })

    return NextResponse.json({
      existing,
      total: existingNodes.length,
      requested: (nodeIds?.length || 0) + (githubUrls?.length || 0)
    })
  } catch (error) {
    console.error('Error checking existing nodes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}