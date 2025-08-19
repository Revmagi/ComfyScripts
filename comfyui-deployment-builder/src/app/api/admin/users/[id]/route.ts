import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { updateUserSchema } from '@/lib/validations'

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
    const user = await db.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            deployments: true,
            apiTokens: true
          }
        },
        deployments: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            isTemplate: true,
            isPublic: true
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        apiTokens: {
          select: {
            id: true,
            name: true,
            service: true,
            isActive: true,
            lastUsed: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Transform response
    const transformedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      deploymentCount: user._count.deployments,
      apiTokenCount: user._count.apiTokens,
      recentDeployments: user.deployments.map(d => ({
        id: d.id,
        name: d.name,
        createdAt: d.createdAt.toISOString(),
        isTemplate: d.isTemplate,
        isPublic: d.isPublic
      })),
      apiTokens: user.apiTokens.map(token => ({
        id: token.id,
        name: token.name,
        service: token.service,
        isActive: token.isActive,
        lastUsed: token.lastUsed?.toISOString() || null,
        createdAt: token.createdAt.toISOString()
      }))
    }

    return NextResponse.json(transformedUser)
  } catch (error) {
    console.error('Error fetching user:', error)
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
    const validationResult = updateUserSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const updateData = validationResult.data

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if email is being changed and if it conflicts
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailConflict = await db.user.findUnique({
        where: { email: updateData.email }
      })

      if (emailConflict) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 409 }
        )
      }
    }

    // Update user
    const user = await db.user.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            deployments: true,
            apiTokens: true
          }
        }
      }
    })

    // Transform response
    const transformedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      deploymentCount: user._count.deployments,
      apiTokenCount: user._count.apiTokens
    }

    return NextResponse.json(transformedUser)
  } catch (error) {
    console.error('Error updating user:', error)
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
    
    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            deployments: true
          }
        }
      }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent deletion of the current admin user
    if (existingUser.id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Check if user has deployments
    if (existingUser._count.deployments > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete user with existing deployments',
          details: `User has ${existingUser._count.deployments} deployment(s)`
        },
        { status: 400 }
      )
    }

    // Delete user (cascading deletes will handle related records)
    await db.user.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}