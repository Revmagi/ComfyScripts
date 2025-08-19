import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createComfyUIRegistryClient } from '@/lib/clients/comfyui-registry'
import { z } from 'zod'

const importRequestSchema = z.object({
  nodeId: z.string().min(1, 'Node ID is required'),
  versionId: z.string().optional()
})

interface ImportRequest {
  nodeId: string
  versionId?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'CURATOR'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: ImportRequest = await request.json()
    
    // Validate request body
    const validationResult = importRequestSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid request body',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const { nodeId, versionId } = validationResult.data

    // Create ComfyUI Registry client
    const registryClient = await createComfyUIRegistryClient()
    
    // Fetch node details from ComfyUI Registry
    const registryNode = await registryClient.getNode(nodeId)
    
    if (!registryNode) {
      return NextResponse.json({ error: 'Node not found in ComfyUI Registry' }, { status: 404 })
    }

    // Get GitHub URL
    const githubUrl = registryClient.extractGitHubUrl(registryNode.repository)
    if (!githubUrl) {
      return NextResponse.json({ 
        error: 'Invalid repository URL', 
        details: 'Node does not have a valid GitHub repository URL' 
      }, { status: 400 })
    }

    // Check if node already exists in our database
    const existingNode = await db.customNode.findFirst({
      where: {
        OR: [
          { registryId: nodeId },
          { githubUrl: githubUrl }
        ]
      }
    })

    if (existingNode) {
      return NextResponse.json({ 
        error: 'Custom node already imported',
        nodeId: existingNode.id,
        source: existingNode.source 
      }, { status: 409 })
    }

    // Get installation data
    let installData
    try {
      installData = await registryClient.getNodeInstallData(nodeId, versionId)
    } catch (error) {
      console.warn('Failed to get install data, using basic info:', error)
      installData = {
        node_id: nodeId,
        name: registryNode.name,
        repository: githubUrl,
        install_type: 'git'
      }
    }

    // Get version information if available
    let latestVersion = registryNode.latest_version
    if (versionId) {
      try {
        latestVersion = await registryClient.getNodeVersion(nodeId, versionId)
      } catch (error) {
        console.warn('Failed to get specific version, using latest:', error)
      }
    }

    // Prepare custom node data for database
    const customNodeData = {
      name: registryNode.name,
      githubUrl: githubUrl,
      branch: installData.branch || 'main',
      description: registryNode.description || null,
      author: registryNode.author || registryNode.publisher?.name || null,
      
      // ComfyUI Registry specific fields
      source: 'COMFYUI_REGISTRY',
      registryId: nodeId,
      registryUrl: `https://registry.comfy.org/nodes/${nodeId}`,
      category: registryNode.category || null,
      
      // Installation details
      installType: installData.install_type || 'git',
      pipRequirements: JSON.stringify(installData.dependencies?.pip_packages || []),
      jsFiles: JSON.stringify(installData.files?.map(f => f.name) || []),
      
      // Metadata
      tags: JSON.stringify(registryNode.tags || []),
      nodeClasses: JSON.stringify([]), // Will be populated when we analyze the node
      
      // Status
      isActive: true,
      isVerified: registryClient.isNodeSafe(registryNode), // Auto-verify safe nodes
      lastValidated: new Date()
    }

    console.log('Importing ComfyUI Registry node:', {
      nodeId,
      name: customNodeData.name,
      githubUrl: customNodeData.githubUrl,
      category: customNodeData.category
    })

    // Create the custom node in database
    const createdNode = await db.customNode.create({
      data: customNodeData
    })

    // Transform response
    const responseNode = {
      id: createdNode.id,
      name: createdNode.name,
      description: createdNode.description,
      githubUrl: createdNode.githubUrl,
      branch: createdNode.branch,
      author: createdNode.author,
      category: createdNode.category,
      source: createdNode.source,
      registryId: createdNode.registryId,
      registryUrl: createdNode.registryUrl,
      installType: createdNode.installType,
      pipRequirements: JSON.parse(createdNode.pipRequirements),
      tags: JSON.parse(createdNode.tags),
      isActive: createdNode.isActive,
      isVerified: createdNode.isVerified,
      createdAt: createdNode.createdAt.toISOString(),
      // Add version info if available
      latestVersion: latestVersion ? {
        id: latestVersion.id,
        version: latestVersion.version,
        description: latestVersion.description,
        createdAt: latestVersion.created_at
      } : null
    }

    return NextResponse.json(responseNode, { status: 201 })
  } catch (error) {
    console.error('Error importing ComfyUI Registry node:', error)
    
    if (error instanceof Error && error.message.includes('ComfyUI Registry API')) {
      return NextResponse.json({
        error: 'Failed to fetch node from ComfyUI Registry',
        details: error.message
      }, { status: 502 })
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get import status and history for ComfyUI Registry nodes
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

    // Get imported ComfyUI Registry nodes
    const [nodes, total] = await Promise.all([
      db.customNode.findMany({
        where: {
          source: 'COMFYUI_REGISTRY'
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.customNode.count({
        where: {
          source: 'COMFYUI_REGISTRY'
        }
      })
    ])

    // Transform nodes for response
    const transformedNodes = nodes.map(node => ({
      id: node.id,
      name: node.name,
      description: node.description,
      githubUrl: node.githubUrl,
      author: node.author,
      category: node.category,
      registryId: node.registryId,
      registryUrl: node.registryUrl,
      tags: JSON.parse(node.tags),
      isActive: node.isActive,
      isVerified: node.isVerified,
      createdAt: node.createdAt.toISOString(),
      lastValidated: node.lastValidated?.toISOString()
    }))

    return NextResponse.json({
      nodes: transformedNodes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching imported ComfyUI Registry nodes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}