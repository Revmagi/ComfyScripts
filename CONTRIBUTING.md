# Contributing to ComfyUI Deployment Builder

Thank you for your interest in contributing to the ComfyUI Deployment Builder! This document provides guidelines and information for contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/comfyui-deployment-builder.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Follow the setup instructions in [README.md](./README.md)

## Development Guidelines

### Code Style
- Use TypeScript strict mode
- Follow Prettier configuration (run `npm run format`)
- Use ESLint rules (run `npm run lint`)
- Write meaningful commit messages using [Conventional Commits](https://www.conventionalcommits.org/)

### Testing
- Write tests for new features
- Ensure all tests pass: `npm test`
- Maintain or improve test coverage
- Test API integrations with mock data

### Pull Request Process

1. **Update Documentation**: Ensure any new features are documented
2. **Test Coverage**: Add tests for new functionality
3. **Code Review**: All PRs require review from maintainers
4. **CI/CD**: Ensure all automated checks pass

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tooling changes

Examples:
```
feat(api): add CivitAI model search endpoint
fix(auth): resolve token expiration issue
docs(readme): update installation instructions
```

## Project Structure

```
├── app/                 # Next.js App Router
├── components/          # React components
├── lib/                 # Utilities and clients
├── prisma/             # Database schema
├── scripts/            # Utility scripts
├── templates/          # Script generation templates
└── docs/               # Additional documentation
```

## API Integration Guidelines

### External APIs
- Always implement rate limiting
- Include proper error handling and retries
- Cache responses when appropriate
- Use environment variables for API keys

### Database Operations
- Use Prisma for all database operations
- Include proper transaction handling
- Validate input data with Zod schemas
- Consider performance implications

## Issue Reporting

When reporting issues, please include:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Screenshots if applicable

## Feature Requests

For new features:
- Check existing issues and roadmap
- Provide clear use case and requirements
- Consider backwards compatibility
- Discuss architecture implications

## Security

- Never commit API keys or sensitive data
- Report security vulnerabilities privately
- Follow secure coding practices
- Validate all user inputs

## Documentation

- Update relevant documentation for changes
- Include code examples for new APIs
- Keep README.md current
- Add JSDoc comments for complex functions

## Community Guidelines

- Be respectful and inclusive
- Help others learn and contribute
- Share knowledge and best practices
- Follow the [Code of Conduct](./CODE_OF_CONDUCT.md)

## Release Process

1. Version bump following [Semantic Versioning](https://semver.org/)
2. Update CHANGELOG.md
3. Create release notes
4. Tag release in GitHub
5. Deploy to production

## Getting Help

- 💬 Discord: [Community Server](https://discord.gg/comfyui-builder)
- 📧 Email: contributors@comfyui-builder.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/comfyui-deployment-builder/issues)

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Community highlights

Thank you for contributing to make ComfyUI deployment easier for everyone! 🚀