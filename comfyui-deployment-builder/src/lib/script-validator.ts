export interface ValidationResult {
  valid: boolean
  score: number
  issues: ValidationIssue[]
  suggestions: string[]
  securityScore: number
  performanceScore: number
  reliabilityScore: number
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info' | 'security' | 'performance'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  line?: number
  solution?: string
  category: string
}

export interface TestCase {
  id: string
  name: string
  description: string
  type: 'syntax' | 'security' | 'performance' | 'functionality'
  test: (script: string, config?: any) => ValidationIssue[]
}

export class ScriptValidator {
  private testCases: TestCase[] = []

  constructor() {
    this.initializeTestCases()
  }

  private initializeTestCases() {
    // Syntax validation tests
    this.testCases.push({
      id: 'docker-syntax',
      name: 'Docker Syntax Validation',
      description: 'Validates Dockerfile syntax and best practices',
      type: 'syntax',
      test: (script: string) => {
        const issues: ValidationIssue[] = []
        const lines = script.split('\n')

        lines.forEach((line, index) => {
          const trimmed = line.trim()
          
          // Check for FROM instruction
          if (trimmed.startsWith('FROM') && !trimmed.includes(':')) {
            issues.push({
              type: 'warning',
              severity: 'medium',
              message: 'FROM instruction should specify a tag',
              line: index + 1,
              solution: 'Add a specific version tag (e.g., FROM ubuntu:20.04)',
              category: 'Best Practices'
            })
          }

          // Check for package manager cleanup
          if (trimmed.includes('apt-get install') && !script.includes('rm -rf /var/lib/apt/lists/*')) {
            issues.push({
              type: 'warning',
              severity: 'medium',
              message: 'apt-get install without cleanup increases image size',
              line: index + 1,
              solution: 'Add && rm -rf /var/lib/apt/lists/* after apt-get install',
              category: 'Optimization'
            })
          }

          // Check for missing WORKDIR
          if (trimmed.startsWith('RUN cd ') || trimmed.startsWith('COPY . .')) {
            issues.push({
              type: 'warning',
              severity: 'low',
              message: 'Consider using WORKDIR instead of cd or relative paths',
              line: index + 1,
              solution: 'Use WORKDIR instruction to set working directory',
              category: 'Best Practices'
            })
          }

          // Check for privileged operations
          if (trimmed.includes('sudo') || trimmed.includes('su -')) {
            issues.push({
              type: 'security',
              severity: 'high',
              message: 'Avoid using sudo or su in containers',
              line: index + 1,
              solution: 'Run containers as non-root user or use proper permissions',
              category: 'Security'
            })
          }
        })

        return issues
      }
    })

    // Security validation tests
    this.testCases.push({
      id: 'security-scan',
      name: 'Security Best Practices',
      description: 'Scans for common security vulnerabilities',
      type: 'security',
      test: (script: string) => {
        const issues: ValidationIssue[] = []
        const lines = script.split('\n')

        lines.forEach((line, index) => {
          const trimmed = line.trim()
          
          // Check for hardcoded secrets
          const secretPatterns = [
            /password\s*=\s*["'][^"']+["']/i,
            /api[_-]?key\s*=\s*["'][^"']+["']/i,
            /secret\s*=\s*["'][^"']+["']/i,
            /token\s*=\s*["'][^"']+["']/i
          ]

          secretPatterns.forEach(pattern => {
            if (pattern.test(trimmed)) {
              issues.push({
                type: 'security',
                severity: 'critical',
                message: 'Hardcoded secret detected',
                line: index + 1,
                solution: 'Use environment variables or secrets management',
                category: 'Security'
              })
            }
          })

          // Check for running as root
          if (trimmed.includes('USER root') || trimmed.includes('--user=0')) {
            issues.push({
              type: 'security',
              severity: 'high',
              message: 'Running as root user is not recommended',
              line: index + 1,
              solution: 'Create and use a non-root user',
              category: 'Security'
            })
          }

          // Check for curl without verification
          if (trimmed.includes('curl') && !trimmed.includes('-k') && !trimmed.includes('--insecure')) {
            // This is actually good, but let's check for the bad case
          } else if (trimmed.includes('curl') && (trimmed.includes('-k') || trimmed.includes('--insecure'))) {
            issues.push({
              type: 'security',
              severity: 'medium',
              message: 'Insecure curl command detected',
              line: index + 1,
              solution: 'Remove -k or --insecure flags to verify SSL certificates',
              category: 'Security'
            })
          }

          // Check for downloading without integrity verification
          if ((trimmed.includes('wget') || trimmed.includes('curl')) && 
              trimmed.includes('http://')) {
            issues.push({
              type: 'security',
              severity: 'medium',
              message: 'Downloading over insecure HTTP',
              line: index + 1,
              solution: 'Use HTTPS for secure downloads',
              category: 'Security'
            })
          }
        })

        return issues
      }
    })

    // Performance validation tests
    this.testCases.push({
      id: 'performance-optimization',
      name: 'Performance Optimization',
      description: 'Checks for performance anti-patterns',
      type: 'performance',
      test: (script: string) => {
        const issues: ValidationIssue[] = []
        const lines = script.split('\n')

        // Check for layer optimization
        let runStatements = 0
        lines.forEach((line, index) => {
          const trimmed = line.trim()
          
          if (trimmed.startsWith('RUN ')) {
            runStatements++
          }

          // Check for multiple RUN statements that could be combined
          if (runStatements > 10) {
            issues.push({
              type: 'performance',
              severity: 'medium',
              message: 'Too many RUN statements can increase image layers',
              line: index + 1,
              solution: 'Combine related RUN statements using && operators',
              category: 'Optimization'
            })
          }

          // Check for missing --no-cache-dir with pip
          if (trimmed.includes('pip install') && !trimmed.includes('--no-cache-dir')) {
            issues.push({
              type: 'performance',
              severity: 'low',
              message: 'pip install without --no-cache-dir increases image size',
              line: index + 1,
              solution: 'Add --no-cache-dir flag to pip install commands',
              category: 'Optimization'
            })
          }

          // Check for missing multi-stage builds for large images
          if (trimmed.includes('FROM') && script.includes('build-essential') && 
              !script.includes('AS builder')) {
            issues.push({
              type: 'performance',
              severity: 'medium',
              message: 'Consider using multi-stage builds for applications with build dependencies',
              line: index + 1,
              solution: 'Use multi-stage builds to reduce final image size',
              category: 'Optimization'
            })
          }
        })

        return issues
      }
    })

    // Shell script validation
    this.testCases.push({
      id: 'shell-syntax',
      name: 'Shell Script Validation',
      description: 'Validates shell script syntax and best practices',
      type: 'syntax',
      test: (script: string) => {
        const issues: ValidationIssue[] = []
        const lines = script.split('\n')

        lines.forEach((line, index) => {
          const trimmed = line.trim()
          
          // Check for missing shebang
          if (index === 0 && !trimmed.startsWith('#!')) {
            issues.push({
              type: 'warning',
              severity: 'low',
              message: 'Missing shebang line',
              line: index + 1,
              solution: 'Add #!/bin/bash at the beginning',
              category: 'Best Practices'
            })
          }

          // Check for unquoted variables
          const unquotedVarPattern = /\$[A-Za-z_][A-Za-z0-9_]*(?![A-Za-z0-9_"'])/
          if (unquotedVarPattern.test(trimmed) && !trimmed.includes('"$')) {
            issues.push({
              type: 'warning',
              severity: 'medium',
              message: 'Unquoted variable usage can cause issues with spaces',
              line: index + 1,
              solution: 'Quote variables like "$VARIABLE" to prevent word splitting',
              category: 'Best Practices'
            })
          }

          // Check for missing error handling
          if (trimmed.includes('&&') && !script.includes('set -e') && !script.includes('|| exit')) {
            issues.push({
              type: 'warning',
              severity: 'medium',
              message: 'Consider adding error handling',
              line: index + 1,
              solution: 'Add "set -e" at the top or use || exit 1 for error handling',
              category: 'Reliability'
            })
          }

          // Check for command substitution without error checking
          if (trimmed.includes('$(') && !trimmed.includes('||') && !script.includes('set -e')) {
            issues.push({
              type: 'warning',
              severity: 'low',
              message: 'Command substitution without error checking',
              line: index + 1,
              solution: 'Check command exit status or use set -e',
              category: 'Reliability'
            })
          }
        })

        return issues
      }
    })

    // Resource usage validation
    this.testCases.push({
      id: 'resource-limits',
      name: 'Resource Usage Validation',
      description: 'Checks for proper resource limit configurations',
      type: 'functionality',
      test: (script: string, config?: any) => {
        const issues: ValidationIssue[] = []

        // Check for memory limits
        if (!script.includes('memory') && !script.includes('--memory')) {
          issues.push({
            type: 'warning',
            severity: 'low',
            message: 'No memory limits specified',
            solution: 'Consider adding memory limits to prevent OOM issues',
            category: 'Resource Management'
          })
        }

        // Check for GPU configuration
        if (script.includes('cuda') || script.includes('gpu')) {
          if (!script.includes('nvidia-docker') && !script.includes('--gpus') && 
              !script.includes('nvidia/cuda')) {
            issues.push({
              type: 'error',
              severity: 'high',
              message: 'GPU usage detected but no proper GPU runtime configuration',
              solution: 'Configure Docker with GPU support or use nvidia/cuda base image',
              category: 'Configuration'
            })
          }
        }

        // Check for port exposure
        if (script.includes('8188') || script.includes('ComfyUI')) {
          if (!script.includes('EXPOSE') && !script.includes('-p 8188')) {
            issues.push({
              type: 'warning',
              severity: 'medium',
              message: 'ComfyUI port not properly exposed',
              solution: 'Add EXPOSE 8188 or configure port mapping',
              category: 'Configuration'
            })
          }
        }

        return issues
      }
    })
  }

  validateScript(script: string, config?: any): ValidationResult {
    const allIssues: ValidationIssue[] = []
    
    // Run all test cases
    this.testCases.forEach(testCase => {
      try {
        const issues = testCase.test(script, config)
        allIssues.push(...issues)
      } catch (error) {
        allIssues.push({
          type: 'error',
          severity: 'medium',
          message: `Validation test "${testCase.name}" failed: ${error}`,
          category: 'Validation Error'
        })
      }
    })

    // Calculate scores
    const securityScore = this.calculateSecurityScore(allIssues)
    const performanceScore = this.calculatePerformanceScore(allIssues)
    const reliabilityScore = this.calculateReliabilityScore(allIssues)
    
    const overallScore = Math.round((securityScore + performanceScore + reliabilityScore) / 3)

    // Generate suggestions
    const suggestions = this.generateSuggestions(allIssues, script)

    return {
      valid: allIssues.filter(issue => issue.type === 'error').length === 0,
      score: overallScore,
      issues: allIssues,
      suggestions,
      securityScore,
      performanceScore,
      reliabilityScore
    }
  }

  private calculateSecurityScore(issues: ValidationIssue[]): number {
    const securityIssues = issues.filter(issue => 
      issue.type === 'security' || issue.category === 'Security'
    )
    
    let deductions = 0
    securityIssues.forEach(issue => {
      switch (issue.severity) {
        case 'critical': deductions += 30; break
        case 'high': deductions += 20; break
        case 'medium': deductions += 10; break
        case 'low': deductions += 5; break
      }
    })

    return Math.max(0, 100 - deductions)
  }

  private calculatePerformanceScore(issues: ValidationIssue[]): number {
    const performanceIssues = issues.filter(issue => 
      issue.type === 'performance' || issue.category === 'Optimization'
    )
    
    let deductions = 0
    performanceIssues.forEach(issue => {
      switch (issue.severity) {
        case 'critical': deductions += 25; break
        case 'high': deductions += 15; break
        case 'medium': deductions += 10; break
        case 'low': deductions += 5; break
      }
    })

    return Math.max(0, 100 - deductions)
  }

  private calculateReliabilityScore(issues: ValidationIssue[]): number {
    const reliabilityIssues = issues.filter(issue => 
      issue.category === 'Reliability' || issue.category === 'Best Practices'
    )
    
    let deductions = 0
    reliabilityIssues.forEach(issue => {
      switch (issue.severity) {
        case 'critical': deductions += 25; break
        case 'high': deductions += 15; break
        case 'medium': deductions += 8; break
        case 'low': deductions += 3; break
      }
    })

    return Math.max(0, 100 - deductions)
  }

  private generateSuggestions(issues: ValidationIssue[], script: string): string[] {
    const suggestions: string[] = []

    // Security suggestions
    const securityIssues = issues.filter(i => i.type === 'security')
    if (securityIssues.length > 0) {
      suggestions.push('Review security practices: avoid hardcoded secrets and running as root')
    }

    // Performance suggestions
    const performanceIssues = issues.filter(i => i.type === 'performance')
    if (performanceIssues.length > 0) {
      suggestions.push('Optimize for smaller image size: combine RUN statements and clean package caches')
    }

    // Syntax suggestions
    if (script.includes('FROM') && issues.some(i => i.category === 'Best Practices')) {
      suggestions.push('Follow Docker best practices: use specific tags and proper layer caching')
    }

    // Error handling
    if (script.includes('#!/bin/bash') && !script.includes('set -e')) {
      suggestions.push('Add error handling: use "set -e" for safer script execution')
    }

    // Resource management
    if (!script.includes('USER ') && script.includes('FROM')) {
      suggestions.push('Consider running as non-root user for better security')
    }

    return suggestions
  }

  getTestCases(): TestCase[] {
    return this.testCases
  }

  addTestCase(testCase: TestCase): void {
    this.testCases.push(testCase)
  }

  removeTestCase(id: string): void {
    this.testCases = this.testCases.filter(tc => tc.id !== id)
  }
}

export const scriptValidator = new ScriptValidator()