'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  AlertTriangle,
  CheckCircle,
  Info,
  Shield,
  Zap,
  RefreshCw,
  Bug,
  AlertCircle,
  TrendingUp,
  Activity
} from 'lucide-react'
import { scriptValidator, type ValidationResult, type ValidationIssue } from '@/lib/script-validator'

interface ScriptValidationPanelProps {
  script: string
  config?: any
  onValidationComplete?: (result: ValidationResult) => void
}

export function ScriptValidationPanel({ script, config, onValidationComplete }: ScriptValidationPanelProps) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    if (script.trim()) {
      validateScript()
    }
  }, [script])

  const validateScript = async () => {
    setIsValidating(true)
    
    // Simulate async validation
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    try {
      const result = scriptValidator.validateScript(script, config)
      setValidationResult(result)
      onValidationComplete?.(result)
    } catch (error) {
      console.error('Validation failed:', error)
    } finally {
      setIsValidating(false)
    }
  }

  const getIssueIcon = (issue: ValidationIssue) => {
    switch (issue.type) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'security':
        return <Shield className="h-4 w-4 text-red-600" />
      case 'performance':
        return <Zap className="h-4 w-4 text-blue-500" />
      default:
        return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    if (score >= 50) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreText = (score: number) => {
    if (score >= 90) return 'Excellent'
    if (score >= 70) return 'Good'
    if (score >= 50) return 'Fair'
    return 'Needs Improvement'
  }

  const filteredIssues = validationResult?.issues.filter(issue => {
    if (selectedCategory === 'all') return true
    if (selectedCategory === 'security') return issue.type === 'security' || issue.category === 'Security'
    if (selectedCategory === 'performance') return issue.type === 'performance' || issue.category === 'Optimization'
    if (selectedCategory === 'errors') return issue.type === 'error'
    if (selectedCategory === 'warnings') return issue.type === 'warning'
    return issue.category === selectedCategory
  }) || []

  if (!script.trim()) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-gray-500">
            <Bug className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Generate a script to see validation results</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Validation Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Script Validation
            </span>
            <Button 
              onClick={validateScript} 
              disabled={isValidating}
              size="sm"
              variant="outline"
            >
              {isValidating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-validate
                </>
              )}
            </Button>
          </CardTitle>
          <CardDescription>
            Automated analysis of your deployment script for security, performance, and best practices
          </CardDescription>
        </CardHeader>
      </Card>

      {isValidating ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600">Analyzing script...</p>
            </div>
          </CardContent>
        </Card>
      ) : validationResult ? (
        <>
          {/* Score Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Overall Score</p>
                    <p className={`text-2xl font-bold ${getScoreColor(validationResult.score)}`}>
                      {validationResult.score}
                    </p>
                    <p className="text-xs text-gray-500">{getScoreText(validationResult.score)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium">Security</p>
                    <p className={`text-2xl font-bold ${getScoreColor(validationResult.securityScore)}`}>
                      {validationResult.securityScore}
                    </p>
                    <Progress value={validationResult.securityScore} className="h-2 mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Performance</p>
                    <p className={`text-2xl font-bold ${getScoreColor(validationResult.performanceScore)}`}>
                      {validationResult.performanceScore}
                    </p>
                    <Progress value={validationResult.performanceScore} className="h-2 mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Reliability</p>
                    <p className={`text-2xl font-bold ${getScoreColor(validationResult.reliabilityScore)}`}>
                      {validationResult.reliabilityScore}
                    </p>
                    <Progress value={validationResult.reliabilityScore} className="h-2 mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Issues Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Issues Summary</CardTitle>
              <CardDescription>
                {validationResult.issues.length} issue(s) found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge 
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory('all')}
                >
                  All ({validationResult.issues.length})
                </Badge>
                <Badge 
                  variant={selectedCategory === 'errors' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory('errors')}
                >
                  Errors ({validationResult.issues.filter(i => i.type === 'error').length})
                </Badge>
                <Badge 
                  variant={selectedCategory === 'warnings' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory('warnings')}
                >
                  Warnings ({validationResult.issues.filter(i => i.type === 'warning').length})
                </Badge>
                <Badge 
                  variant={selectedCategory === 'security' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory('security')}
                >
                  Security ({validationResult.issues.filter(i => i.type === 'security').length})
                </Badge>
                <Badge 
                  variant={selectedCategory === 'performance' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory('performance')}
                >
                  Performance ({validationResult.issues.filter(i => i.type === 'performance').length})
                </Badge>
              </div>

              <div className="space-y-3">
                {filteredIssues.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>No issues found in this category</p>
                  </div>
                ) : (
                  filteredIssues.map((issue, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-2">
                          {getIssueIcon(issue)}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <p className="font-medium">{issue.message}</p>
                              <Badge 
                                className={`text-xs ${getSeverityColor(issue.severity)}`}
                                variant="outline"
                              >
                                {issue.severity}
                              </Badge>
                            </div>
                            {issue.line && (
                              <p className="text-sm text-gray-500">Line {issue.line}</p>
                            )}
                            <p className="text-xs text-gray-600 mt-1">{issue.category}</p>
                          </div>
                        </div>
                      </div>
                      {issue.solution && (
                        <div className="ml-6 p-3 bg-blue-50 rounded border border-blue-200">
                          <p className="text-sm text-blue-800">
                            <strong>Solution:</strong> {issue.solution}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Suggestions */}
          {validationResult.suggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Improvement Suggestions</CardTitle>
                <CardDescription>
                  Recommendations to enhance your deployment script
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {validationResult.suggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{suggestion}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}