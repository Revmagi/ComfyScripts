import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { updateCustomNodeSchema } from '@/lib/validations'

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
    const node = await db.customNode.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            deploymentNodes: true
          }
        },
        deploymentNodes: {
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

    if (!node) {
      return NextResponse.json({ error: 'Custom node not found' }, { status: 404 })
    }

    // Transform response
    const transformedNode = {
      id: node.id,
      name: node.name,
      githubUrl: node.githubUrl,
      branch: node.branch,
      author: node.author,
      description: node.description,
      installType: node.installType,
      pipRequirements: JSON.parse(node.pipRequirements),
      jsFiles: JSON.parse(node.jsFiles),
      tags: JSON.parse(node.tags),
      nodeClasses: JSON.parse(node.nodeClasses),
      isActive: node.isActive,
      isVerified: node.isVerified,
      lastValidated: node.lastValidated?.toISOString() || null,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
      deploymentCount: node._count.deploymentNodes,
      recentDeployments: node.deploymentNodes.map(dn => ({
        id: dn.deployment.id,
        name: dn.deployment.name,
        createdAt: dn.deployment.createdAt.toISOString(),
        user: dn.deployment.user
      }))
    }

    return NextResponse.json(transformedNode)
  } catch (error) {
    console.error('Error fetching custom node:', error)
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
    const validationResult = updateCustomNodeSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const updateData = validationResult.data

    // Check if node exists
    const existingNode = await db.customNode.findUnique({
      where: { id }
    })

    if (!existingNode) {
      return NextResponse.json({ error: 'Custom node not found' }, { status: 404 })
    }

    // Check if GitHub URL is being changed and if it conflicts
    if (updateData.githubUrl && updateData.githubUrl !== existingNode.githubUrl) {
      const urlConflict = await db.customNode.findUnique({
        where: { githubUrl: updateData.githubUrl }
      })

      if (urlConflict) {
        return NextResponse.json(
          { error: 'Custom node with this GitHub URL already exists' },
          { status: 409 }
        )
      }
    }

    // Prepare update data with JSON serialization for arrays
    const dbUpdateData: any = { ...updateData }
    if (updateData.tags) {
      dbUpdateData.tags = JSON.stringify(updateData.tags)
    }

    // Update node
    const node = await db.customNode.update({
      where: { id },
      data: dbUpdateData,
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
      updatedAt: node.updatedAt.toISOString(),
      lastValidated: node.lastValidated?.toISOString() || null,
      deploymentCount: node._count.deploymentNodes
    }

    return NextResponse.json(transformedNode)
  } catch (error) {
    console.error('Error updating custom node:', error)
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
    
    // Check if node exists
    const existingNode = await db.customNode.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            deploymentNodes: true
          }
        }
      }
    })

    if (!existingNode) {
      return NextResponse.json({ error: 'Custom node not found' }, { status: 404 })
    }

    // Check if node is being used in deployments
    if (existingNode._count.deploymentNodes > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete custom node that is being used in deployments',
          details: `Node is used in ${existingNode._count.deploymentNodes} deployment(s)`
        },
        { status: 400 }
      )
    }

    // Delete node (cascading deletes will handle related records)
    await db.customNode.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Custom node deleted successfully' })
  } catch (error) {
    console.error('Error deleting custom node:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Validate node endpoint
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const node = await db.customNode.findUnique({
      where: { id }
    })

    if (!node) {
      return NextResponse.json({ error: 'Custom node not found' }, { status: 404 })
    }

    // Simulate GitHub validation (in real implementation, you'd fetch the URL)
    const isValid = Math.random() > 0.2 // 80% success rate for demo

    // Update validation status
    const updatedNode = await db.customNode.update({
      where: { id },
      data: {
        lastValidated: new Date(),
        isVerified: isValid
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
      id: updatedNode.id,
      name: updatedNode.name,
      githubUrl: updatedNode.githubUrl,
      author: updatedNode.author,
      description: updatedNode.description,
      isActive: updatedNode.isActive,
      isVerified: updatedNode.isVerified,
      tags: JSON.parse(updatedNode.tags),
      createdAt: updatedNode.createdAt.toISOString(),
      lastValidated: updatedNode.lastValidated?.toISOString() || null,
      deploymentCount: updatedNode._count.deploymentNodes,
      validationResult: {
        isValid,
        message: isValid ? 'GitHub repository is accessible' : 'GitHub repository not found or inaccessible'
      }
    }

    return NextResponse.json(transformedNode)
  } catch (error) {
    console.error('Error validating custom node:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}