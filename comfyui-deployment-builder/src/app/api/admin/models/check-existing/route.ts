import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Source } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'CURATOR'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { source, modelIds } = body

    if (!source || !modelIds || !Array.isArray(modelIds)) {
      return NextResponse.json({ 
        error: 'Source and modelIds array are required' 
      }, { status: 400 })
    }

    if (modelIds.length === 0) {
      return NextResponse.json({ existing: {} })
    }

    // Limit to reasonable batch size to prevent database overload
    if (modelIds.length > 100) {
      return NextResponse.json({ 
        error: 'Too many model IDs. Maximum 100 per request.' 
      }, { status: 400 })
    }

    // Check which models already exist in the database
    const existingModels = await db.model.findMany({
      where: {
        source: source as Source,
        sourceId: {
          in: modelIds
        }
      },
      select: {
        sourceId: true,
        id: true,
        name: true,
        isActive: true,
        createdAt: true
      }
    })

    // Create a lookup map for O(1) checking
    const existingMap: Record<string, any> = {}
    existingModels.forEach(model => {
      if (model.sourceId) {
        existingMap[model.sourceId] = {
          id: model.id,
          name: model.name,
          isActive: model.isActive,
          importedAt: model.createdAt.toISOString()
        }
      }
    })

    return NextResponse.json({ 
      existing: existingMap,
      checkedCount: modelIds.length,
      existingCount: existingModels.length
    })

  } catch (error) {
    console.error('Error checking existing models:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}