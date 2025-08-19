'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  Package, 
  Database, 
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Upload
} from 'lucide-react'

interface DashboardStats {
  totalUsers: number
  totalCustomNodes: number
  totalModels: number
  totalDeployments: number
  recentActivity: Array<{
    id: string
    type: string
    description: string
    timestamp: string
    status: 'success' | 'warning' | 'error'
  }>
  systemHealth: {
    database: 'healthy' | 'warning' | 'error'
    apis: 'healthy' | 'warning' | 'error'
    storage: 'healthy' | 'warning' | 'error'
  }
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalCustomNodes: 0,
    totalModels: 0,
    totalDeployments: 0,
    recentActivity: [],
    systemHealth: {
      database: 'healthy',
      apis: 'healthy',
      storage: 'healthy'
    }
  })
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    // Simulate loading dashboard data
    setTimeout(() => {
      setStats({
        totalUsers: 12,
        totalCustomNodes: 45,
        totalModels: 128,
        totalDeployments: 34,
        recentActivity: [
          {
            id: '1',
            type: 'user_registered',
            description: 'New user registered: user@example.com',
            timestamp: '2 minutes ago',
            status: 'success'
          },
          {
            id: '2',
            type: 'node_added',
            description: 'Custom node added: ComfyUI-Advanced-Sampling',
            timestamp: '15 minutes ago',
            status: 'success'
          },
          {
            id: '3',
            type: 'model_imported',
            description: 'Model imported from CivitAI: SDXL Base 1.0',
            timestamp: '1 hour ago',
            status: 'success'
          },
          {
            id: '4',
            type: 'deployment_created',
            description: 'Deployment created: Production Setup',
            timestamp: '2 hours ago',
            status: 'success'
          },
          {
            id: '5',
            type: 'url_validation',
            description: 'URL validation failed for 3 models',
            timestamp: '3 hours ago',
            status: 'warning'
          }
        ],
        systemHealth: {
          database: 'healthy',
          apis: 'healthy',
          storage: 'healthy'
        }
      })
      setLoading(false)
    }, 1000)
  }, [])

  const handleSeedData = async (seedType: 'models' | 'nodes' | 'all') => {
    setSeeding(true)
    try {
      const response = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ seedType })
      })

      if (!response.ok) {
        throw new Error('Failed to seed data')
      }

      const result = await response.json()
      alert(`Seed completed! Added ${result.results.models} models and ${result.results.nodes} custom nodes.`)
      
      // Refresh the page to show updated counts
      window.location.reload()
    } catch (error) {
      console.error('Error seeding data:', error)
      alert('Failed to seed data. Please try again.')
    } finally {
      setSeeding(false)
    }
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      description: 'Registered users',
      icon: Users,
      color: 'text-blue-600'
    },
    {
      title: 'Custom Nodes',
      value: stats.totalCustomNodes,
      description: 'Available nodes',
      icon: Package,
      color: 'text-green-600'
    },
    {
      title: 'Models',
      value: stats.totalModels,
      description: 'Total models',
      icon: Database,
      color: 'text-purple-600'
    },
    {
      title: 'Deployments',
      value: stats.totalDeployments,
      description: 'Created deployments',
      icon: TrendingUp,
      color: 'text-orange-600'
    }
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-100 text-green-800">Healthy</Badge>
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
          <p className="text-gray-600">Monitor system performance and recent activity</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.description}</p>
                  </div>
                  <stat.icon className={`h-8 w-8 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest system events and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50">
                    {getStatusIcon(activity.status)}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">{activity.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Current status of system components</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Database</span>
                  {getHealthBadge(stats.systemHealth.database)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">External APIs</span>
                  {getHealthBadge(stats.systemHealth.apis)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Storage</span>
                  {getHealthBadge(stats.systemHealth.storage)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={() => router.push('/admin/users')}
              >
                <Users className="h-4 w-4 mr-2" />
                Manage Users
              </Button>
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={() => router.push('/admin/nodes')}
              >
                <Package className="h-4 w-4 mr-2" />
                Add Custom Node
              </Button>
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={() => router.push('/admin/models')}
              >
                <Database className="h-4 w-4 mr-2" />
                Import Models
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Seed Data */}
        <Card>
          <CardHeader>
            <CardTitle>Database Seeding</CardTitle>
            <CardDescription>Populate database with sample models and custom nodes from installer scripts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={() => handleSeedData('models')}
                disabled={seeding}
              >
                <Download className="h-4 w-4 mr-2" />
                {seeding ? 'Seeding...' : 'Seed Models'}
              </Button>
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={() => handleSeedData('nodes')}
                disabled={seeding}
              >
                <Package className="h-4 w-4 mr-2" />
                {seeding ? 'Seeding...' : 'Seed Custom Nodes'}
              </Button>
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={() => handleSeedData('all')}
                disabled={seeding}
              >
                <Upload className="h-4 w-4 mr-2" />
                {seeding ? 'Seeding...' : 'Seed All Data'}
              </Button>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This will populate the database with models and custom nodes from the RunPod installer scripts. 
                Existing items will be skipped to avoid duplicates.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}