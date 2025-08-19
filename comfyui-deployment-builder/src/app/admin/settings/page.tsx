'use client'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Settings, 
  Key, 
  Shield, 
  Database, 
  Bell, 
  Save,
  RefreshCw
} from 'lucide-react'

export default function AdminSettings() {
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [settings, setSettings] = useState({
    // API Tokens
    civitaiToken: '',
    huggingfaceToken: '',
    
    // System Settings
    maxUploadSize: '10',
    defaultTimeout: '30',
    enableMetrics: true,
    enableLogging: true,
    
    // Security Settings
    enableRateLimit: true,
    maxRequestsPerMinute: '100',
    enableCors: true,
    allowedOrigins: 'http://localhost:3000',
    
    // Notification Settings
    emailNotifications: true,
    slackWebhook: '',
    discordWebhook: ''
  })

  // Load settings on component mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      } else {
        console.error('Failed to load settings')
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setInitialLoading(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        alert('Settings saved successfully!')
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async (service: string) => {
    try {
      // Fix key mapping for HuggingFace
      let tokenKey: keyof typeof settings
      if (service.toLowerCase() === 'huggingface') {
        tokenKey = 'huggingfaceToken'
      } else if (service.toLowerCase() === 'civitai') {
        tokenKey = 'civitaiToken'
      } else {
        tokenKey = `${service.toLowerCase()}Token` as keyof typeof settings
      }
      const token = settings[tokenKey] as string
      
      if (!token) {
        alert(`Please enter a ${service} token first`)
        return
      }

      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service: service.toLowerCase(),
          token
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`${service} test result:`, result)
        if (result.success) {
          alert(result.message || `${service} connection successful`)
        } else {
          alert(result.message || `${service} connection failed`)
        }
      } else {
        const error = await response.json()
        console.error(`${service} test error:`, error)
        alert(error.error || `${service} connection test failed`)
      }
    } catch (error) {
      console.error(`Error testing ${service} connection:`, error)
      alert(`${service} connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (initialLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading settings...</span>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Settings className="h-6 w-6 mr-2" />
              System Settings
            </h2>
            <p className="text-gray-600">Configure API tokens, system preferences, and security settings</p>
          </div>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>

        <Tabs defaultValue="tokens" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tokens">API Tokens</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="tokens" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Key className="h-5 w-5 mr-2" />
                  API Tokens
                </CardTitle>
                <CardDescription>
                  Configure API tokens for external services. These are required for HuggingFace and CivitAI model searches.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="huggingface-token">HuggingFace API Token</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="huggingface-token"
                        type="password"
                        placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={settings.huggingfaceToken}
                        onChange={(e) => setSettings(prev => ({ ...prev, huggingfaceToken: e.target.value }))}
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => testConnection('HuggingFace')}
                      >
                        Test
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Get your token from <a href="https://huggingface.co/settings/tokens" target="_blank" className="text-blue-500 hover:underline">HuggingFace Settings</a>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="civitai-token">CivitAI API Token</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="civitai-token"
                        type="password"
                        placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={settings.civitaiToken}
                        onChange={(e) => setSettings(prev => ({ ...prev, civitaiToken: e.target.value }))}
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => testConnection('CivitAI')}
                      >
                        Test
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Get your token from <a href="https://civitai.com/user/account" target="_blank" className="text-blue-500 hover:underline">CivitAI Account Settings</a>
                    </p>
                  </div>

                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  System Configuration
                </CardTitle>
                <CardDescription>
                  Configure system-wide settings and performance parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-upload">Max Upload Size (MB)</Label>
                    <Input
                      id="max-upload"
                      type="number"
                      value={settings.maxUploadSize}
                      onChange={(e) => setSettings(prev => ({ ...prev, maxUploadSize: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeout">Default Timeout (seconds)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      value={settings.defaultTimeout}
                      onChange={(e) => setSettings(prev => ({ ...prev, defaultTimeout: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Metrics Collection</Label>
                      <p className="text-sm text-gray-500">Collect usage metrics and analytics</p>
                    </div>
                    <Switch
                      checked={settings.enableMetrics}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableMetrics: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Debug Logging</Label>
                      <p className="text-sm text-gray-500">Log detailed debug information</p>
                    </div>
                    <Switch
                      checked={settings.enableLogging}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableLogging: checked }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Configure security policies and access controls
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Rate Limiting</Label>
                      <p className="text-sm text-gray-500">Limit API requests per minute</p>
                    </div>
                    <Switch
                      checked={settings.enableRateLimit}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableRateLimit: checked }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rate-limit">Max Requests per Minute</Label>
                    <Input
                      id="rate-limit"
                      type="number"
                      value={settings.maxRequestsPerMinute}
                      onChange={(e) => setSettings(prev => ({ ...prev, maxRequestsPerMinute: e.target.value }))}
                      disabled={!settings.enableRateLimit}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable CORS</Label>
                      <p className="text-sm text-gray-500">Allow cross-origin requests</p>
                    </div>
                    <Switch
                      checked={settings.enableCors}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableCors: checked }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="origins">Allowed Origins</Label>
                    <Textarea
                      id="origins"
                      placeholder="https://example.com&#10;https://app.example.com"
                      value={settings.allowedOrigins}
                      onChange={(e) => setSettings(prev => ({ ...prev, allowedOrigins: e.target.value }))}
                      disabled={!settings.enableCors}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="h-5 w-5 mr-2" />
                  Notification Settings
                </CardTitle>
                <CardDescription>
                  Configure how and when you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-gray-500">Receive notifications via email</p>
                    </div>
                    <Switch
                      checked={settings.emailNotifications}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, emailNotifications: checked }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
                    <Input
                      id="slack-webhook"
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={settings.slackWebhook}
                      onChange={(e) => setSettings(prev => ({ ...prev, slackWebhook: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discord-webhook">Discord Webhook URL</Label>
                    <Input
                      id="discord-webhook"
                      type="url"
                      placeholder="https://discord.com/api/webhooks/..."
                      value={settings.discordWebhook}
                      onChange={(e) => setSettings(prev => ({ ...prev, discordWebhook: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  )
}