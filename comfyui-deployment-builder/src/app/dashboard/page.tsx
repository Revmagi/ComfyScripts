'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Folder, 
  Download, 
  Settings,
  TrendingUp,
  Clock,
  CheckCircle,
  Package,
  Database,
  Zap
} from 'lucide-react'

interface DashboardStats {
  totalDeployments: number
  recentDeployments: Array<{
    id: string
    name: string
    createdAt: string
    status: 'active' | 'building' | 'error'
  }>
  quickStats: {
    modelsUsed: number
    nodesUsed: number
    templatesCreated: number
  }
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalDeployments: 0,
    recentDeployments: [],
    quickStats: {
      modelsUsed: 0,
      nodesUsed: 0,
      templatesCreated: 0
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    } else if (session) {
      loadDashboardData()
    }
  }, [status, router, session])

  const loadDashboardData = async () => {
    try {
      // Simulate loading user's dashboard data
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setStats({
        totalDeployments: 12,
        recentDeployments: [
          {
            id: '1',
            name: 'Production SDXL Setup',
            createdAt: '2024-01-20T10:30:00Z',
            status: 'active'
          },
          {
            id: '2',
            name: 'ControlNet Playground',
            createdAt: '2024-01-19T16:45:00Z',
            status: 'active'
          },
          {
            id: '3',
            name: 'LoRA Testing Environment',
            createdAt: '2024-01-18T09:15:00Z',
            status: 'building'
          }
        ],
        quickStats: {
          modelsUsed: 8,
          nodesUsed: 15,
          templatesCreated: 3
        }
      })
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                ComfyUI Deployment Builder
              </h1>
              <p className="text-gray-600">Welcome back, {session.user.name}</p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline">
                {session.user.role}
              </Badge>
              <Button
                variant="outline"
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Folder className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Deployments</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalDeployments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Database className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Models Used</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.quickStats.modelsUsed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Custom Nodes</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.quickStats.nodesUsed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Zap className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Templates</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.quickStats.templatesCreated}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/builder')}>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Plus className="h-5 w-5 mr-2 text-blue-600" />
                    Create New Deployment
                  </CardTitle>
                  <CardDescription>
                    Start building a new ComfyUI deployment from scratch
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600">
                    Configure models, nodes, and settings for your deployment
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Download className="h-5 w-5 mr-2 text-green-600" />
                    Browse Models
                  </CardTitle>
                  <CardDescription>
                    Explore models from CivitAI and HuggingFace
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push('/admin/models/civitai')
                      }}
                    >
                      CivitAI
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push('/admin/models/huggingface')
                      }}
                    >
                      HuggingFace
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Folder className="h-5 w-5 mr-2 text-purple-600" />
                    My Deployments
                  </CardTitle>
                  <CardDescription>
                    View and manage your existing deployments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => router.push('/deployments')}
                  >
                    View All ({stats.totalDeployments})
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2 text-orange-600" />
                    Browse Templates
                  </CardTitle>
                  <CardDescription>
                    Explore community templates and examples
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => router.push('/builder')}
                  >
                    Explore Templates
                  </Button>
                </CardContent>
              </Card>
            </div>

            {session.user.role === 'ADMIN' && (
              <Card className="border-dashed border-2 border-blue-300 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center text-blue-900">
                    <Settings className="h-5 w-5 mr-2" />
                    Admin Access
                  </CardTitle>
                  <CardDescription className="text-blue-700">
                    Access administrative functions and system management
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="default" 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => router.push('/admin/dashboard')}
                  >
                    Open Admin Dashboard
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Activity */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Recent Deployments</h2>
            <div className="space-y-4">
              {stats.recentDeployments.map((deployment) => (
                <Card key={deployment.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 truncate">{deployment.name}</h3>
                        <div className="flex items-center mt-1 text-sm text-gray-500">
                          <Clock className="h-4 w-4 mr-1" />
                          {new Date(deployment.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="ml-4">
                        {deployment.status === 'active' && (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                        {deployment.status === 'building' && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Building
                          </Badge>
                        )}
                        {deployment.status === 'error' && (
                          <Badge variant="destructive">
                            Error
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => router.push('/deployments')}
              >
                View All Deployments
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}