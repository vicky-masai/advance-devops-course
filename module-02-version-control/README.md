# Module 2: Version Control & Collaboration

## Learning Objectives
- Master advanced Git workflows
- Implement branching strategies for enterprise development
- Set up automated code quality checks
- Configure collaborative development environments

## Topics Covered

### 2.1 Advanced Git Workflows
- Git Flow vs GitHub Flow vs GitLab Flow
- Feature branch workflows
- Release management strategies
- Hotfix procedures

### 2.2 Branch Protection & Code Quality
- Branch protection rules
- Required status checks
- Code review processes
- Automated testing integration

### 2.3 Git Hooks & Automation
- Pre-commit hooks
- Pre-push hooks
- Server-side hooks
- Automated code formatting

## Hands-on Lab: Git Workflow Setup

### Git Configuration
```bash
# Global Git configuration
git config --global user.name "Your Name"
git config --global user.email "your.email@company.com"
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global core.autocrlf input

# Set up aliases for common commands
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.unstage 'reset HEAD --'
git config --global alias.last 'log -1 HEAD'
git config --global alias.visual '!gitk'
```

### Branch Strategy Implementation
```bash
# Create feature branch
git checkout -b feature/user-authentication
git push -u origin feature/user-authentication

# Work on feature
git add .
git commit -m "feat: implement user login functionality"

# Keep feature branch updated
git checkout main
git pull origin main
git checkout feature/user-authentication
git rebase main

# Create pull request (via GitHub/GitLab UI)
# After review and approval, merge to main
```

### Pre-commit Hook Setup
```bash
#!/bin/sh
# .git/hooks/pre-commit

# Run linting
npm run lint
if [ $? -ne 0 ]; then
    echo "Linting failed. Please fix errors before committing."
    exit 1
fi

# Run tests
npm test
if [ $? -ne 0 ]; then
    echo "Tests failed. Please fix failing tests before committing."
    exit 1
fi

# Check for sensitive information
if grep -r "API_KEY\|PASSWORD\|SECRET" --exclude-dir=node_modules .; then
    echo "Potential sensitive information found. Please review."
    exit 1
fi

echo "Pre-commit checks passed!"
```

## Assignment
1. Set up Git workflow for the e-commerce project
2. Create feature branches for different components
3. Implement pre-commit hooks
4. Set up branch protection rules
5. Practice code review process

## Best Practices
- Use conventional commit messages
- Keep commits atomic and focused
- Write descriptive commit messages
- Use feature branches for all changes
- Regularly sync with main branch
- Never commit directly to main/master

## Resources
- [Git Flow Cheatsheet](https://danielkummer.github.io/git-flow-cheatsheet/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
