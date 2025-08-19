import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get total counts for nodes
    const [totalNodes, activeNodes, verifiedNodes, inactiveNodes, nonVerifiedNodes] = await Promise.all([
      db.customNode.count(),
      db.customNode.count({ where: { isActive: true } }),
      db.customNode.count({ where: { isVerified: true } }),
      db.customNode.count({ where: { isActive: false } }),
      db.customNode.count({ where: { isVerified: false } })
    ])

    // Format the stats
    const formattedStats = {
      TOTAL: totalNodes,
      ACTIVE: activeNodes,
      VERIFIED: verifiedNodes,
      INACTIVE: inactiveNodes,
      NON_VERIFIED: nonVerifiedNodes
    }

    return NextResponse.json(formattedStats)
  } catch (error) {
    console.error('Error fetching custom nodes stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}