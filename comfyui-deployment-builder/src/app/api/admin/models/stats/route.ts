import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { ModelType } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get counts for each model type
    const stats = await db.model.groupBy({
      by: ['type'],
      _count: {
        _all: true
      }
    })

    // Also get total counts for active/verified models
    const [totalModels, activeModels, verifiedModels] = await Promise.all([
      db.model.count(),
      db.model.count({ where: { isActive: true } }),
      db.model.count({ where: { isVerified: true } })
    ])

    // Format the stats
    const formattedStats: Record<string, number> = {
      TOTAL: totalModels,
      ACTIVE: activeModels,
      VERIFIED: verifiedModels
    }

    // Add each model type count
    stats.forEach(stat => {
      formattedStats[stat.type] = stat._count._all
    })

    // Ensure all model types are represented (with 0 if no models)
    Object.values(ModelType).forEach(type => {
      if (!(type in formattedStats)) {
        formattedStats[type] = 0
      }
    })

    return NextResponse.json(formattedStats)
  } catch (error) {
    console.error('Error fetching model stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}