import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createCustomNodeSchema, searchNodesSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || undefined
    const isActive = searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined
    const isVerified = searchParams.get('isVerified') ? searchParams.get('isVerified') === 'true' : undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Validate search parameters
    const validationResult = searchNodesSchema.safeParse({
      query,
      isActive,
      isVerified,
      page,
      limit
    })

    if (!validationResult.success) {
      console.log('Nodes API validation error:', validationResult.error.errors)
      return NextResponse.json(
        { error: 'Invalid search parameters', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { query: searchQuery, isActive: filterActive, isVerified: filterVerified } = validationResult.data
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (searchQuery) {
      where.OR = [
        { name: { contains: searchQuery } },
        { description: { contains: searchQuery } },
        { author: { contains: searchQuery } }
      ]
    }
    
    if (filterActive !== undefined) {
      where.isActive = filterActive
    }
    
    if (filterVerified !== undefined) {
      where.isVerified = filterVerified
    }

    // Get nodes with deployment counts
    const [nodes, total] = await Promise.all([
      db.customNode.findMany({
        where,
        include: {
          _count: {
            select: {
              deploymentNodes: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.customNode.count({ where })
    ])

    // Transform data for response
    const transformedNodes = nodes.map(node => ({
      id: node.id,
      name: node.name,
      githubUrl: node.githubUrl,
      author: node.author,
      description: node.description,
      isActive: node.isActive,
      isVerified: node.isVerified,
      tags: JSON.parse(node.tags),
      createdAt: node.createdAt.toISOString(),
      lastValidated: node.lastValidated?.toISOString() || null,
      deploymentCount: node._count.deploymentNodes
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
    console.error('Error fetching custom nodes:', error)
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
    const validationResult = createCustomNodeSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const nodeData = validationResult.data

    // Check if node already exists
    const existingNode = await db.customNode.findUnique({
      where: { githubUrl: nodeData.githubUrl }
    })

    if (existingNode) {
      return NextResponse.json(
        { error: 'Custom node with this GitHub URL already exists' },
        { status: 409 }
      )
    }

    // Create node
    const node = await db.customNode.create({
      data: {
        name: nodeData.name,
        githubUrl: nodeData.githubUrl,
        branch: nodeData.branch || 'main',
        author: nodeData.author,
        description: nodeData.description,
        installType: nodeData.installType || 'git',
        pipRequirements: JSON.stringify(nodeData.pipRequirements || []),
        jsFiles: JSON.stringify(nodeData.jsFiles || []),
        tags: JSON.stringify(nodeData.tags || []),
        nodeClasses: JSON.stringify(nodeData.nodeClasses || []),
        isActive: nodeData.isActive,
        isVerified: nodeData.isVerified || false
      },
      include: {
        _count: {
          select: {
            deploymentNodes: true
          }
        }
      }
    })

    // Transform response
    const transformedNode = {
      id: node.id,
      name: node.name,
      githubUrl: node.githubUrl,
      author: node.author,
      description: node.description,
      isActive: node.isActive,
      isVerified: node.isVerified,
      tags: JSON.parse(node.tags),
      createdAt: node.createdAt.toISOString(),
      lastValidated: node.lastValidated?.toISOString() || null,
      deploymentCount: node._count.deploymentNodes
    }

    return NextResponse.json(transformedNode, { status: 201 })
  } catch (error) {
    console.error('Error creating custom node:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}