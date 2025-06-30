# Module 8: Security & Best Practices

## Learning Objectives
- Implement DevSecOps practices
- Set up security scanning and vulnerability management
- Configure secure CI/CD pipelines
- Implement container and Kubernetes security
- Practice incident response and security monitoring

## Topics Covered

### 8.1 DevSecOps Fundamentals
- Security shift-left approach
- Security in CI/CD pipelines
- Threat modeling
- Security testing automation

### 8.2 Container & Kubernetes Security
- Container image security
- Runtime security
- Network policies
- RBAC implementation

### 8.3 Infrastructure Security
- Network security
- Secrets management
- Compliance and governance
- Security monitoring

## Hands-on Lab: Comprehensive Security Implementation

### Security Scanning in CI/CD
```yaml
# .github/workflows/security.yml
name: Security Scanning

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  secret-scanning:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Run TruffleHog
      uses: trufflesecurity/trufflehog@main
      with:
        path: ./
        base: main
        head: HEAD

    - name: GitLeaks Scan
      uses: gitleaks/gitleaks-action@v2
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  dependency-scanning:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run npm audit
      run: npm audit --audit-level high

    - name: Run Snyk
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high

    - name: OWASP Dependency Check
      uses: dependency-check/Dependency-Check_Action@main
      with:
        project: 'ecommerce-app'
        path: '.'
        format: 'ALL'

  sast-scanning:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: SonarCloud Scan
      uses: SonarSource/sonarcloud-github-action@master
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

    - name: CodeQL Analysis
      uses: github/codeql-action/init@v2
      with:
        languages: javascript

    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v2

  container-scanning:
    runs-on: ubuntu-latest
    needs: [secret-scanning, dependency-scanning]
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Build Docker image
      run: docker build -t ecommerce-app:${{ github.sha }} .

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'ecommerce-app:${{ github.sha }}'
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

    - name: Run Anchore Container Scan
      uses: anchore/scan-action@v3
      with:
        image: 'ecommerce-app:${{ github.sha }}'
        fail-build: true
        severity-cutoff: high

  infrastructure-scanning:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run Checkov
      uses: bridgecrewio/checkov-action@master
      with:
        directory: .
        framework: terraform,kubernetes,dockerfile
        output_format: sarif
        output_file_path: checkov-results.sarif

    - name: Upload Checkov results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: checkov-results.sarif

    - name: Run TFSec
      uses: aquasecurity/tfsec-action@v1.0.0
      with:
        soft_fail: true
```

### Kubernetes Security Policies
```yaml
# security/network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-ingress
  namespace: ecommerce
spec:
  podSelector: {}
  policyTypes:
  - Ingress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: ecommerce
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 3000
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-backend-to-database
  namespace: ecommerce
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: backend
    ports:
    - protocol: TCP
      port: 5432
```

### Pod Security Standards
```yaml
# security/pod-security-policy.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ecommerce
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
---
apiVersion: v1
kind: SecurityContext
metadata:
  name: restricted-security-context
spec:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault
  capabilities:
    drop:
    - ALL
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
```

### RBAC Configuration
```yaml
# security/rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ecommerce-backend
  namespace: ecommerce
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: ecommerce
  name: ecommerce-backend-role
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ecommerce-backend-binding
  namespace: ecommerce
subjects:
- kind: ServiceAccount
  name: ecommerce-backend
  namespace: ecommerce
roleRef:
  kind: Role
  name: ecommerce-backend-role
  apiGroup: rbac.authorization.k8s.io
```

### Secrets Management with External Secrets Operator
```yaml
# security/external-secrets.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: ecommerce
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-west-2
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-credentials
  namespace: ecommerce
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: db-credentials
    creationPolicy: Owner
  data:
  - secretKey: username
    remoteRef:
      key: ecommerce/database
      property: username
  - secretKey: password
    remoteRef:
      key: ecommerce/database
      property: password
```

### Security Monitoring with Falco
```yaml
# security/falco-rules.yaml
- rule: Detect shell in container
  desc: Detect shell execution in container
  condition: >
    spawned_process and container and
    (proc.name in (shell_binaries) or
     proc.name in (bash, sh, zsh, fish))
  output: >
    Shell spawned in container (user=%user.name container_id=%container.id
    container_name=%container.name shell=%proc.name parent=%proc.pname
    cmdline=%proc.cmdline)
  priority: WARNING

- rule: Detect privilege escalation
  desc: Detect privilege escalation attempts
  condition: >
    spawned_process and container and
    proc.name in (sudo, su, doas) and
    not user.name in (allowed_users)
  output: >
    Privilege escalation attempt (user=%user.name container_id=%container.id
    container_name=%container.name command=%proc.cmdline)
  priority: CRITICAL

- rule: Detect sensitive file access
  desc: Detect access to sensitive files
  condition: >
    open_read and container and
    fd.name in (/etc/passwd, /etc/shadow, /etc/hosts, /root/.ssh/id_rsa)
  output: >
    Sensitive file accessed (user=%user.name container_id=%container.id
    file=%fd.name command=%proc.cmdline)
  priority: HIGH
```

### Secure Dockerfile
```dockerfile
# Use specific version and minimal base image
FROM node:18.17.0-alpine3.18

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and clean cache
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Copy application code
COPY --chown=nodejs:nodejs . .

# Remove unnecessary packages
RUN apk del --purge wget curl

# Set security headers
ENV NODE_OPTIONS="--max-old-space-size=512"

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js || exit 1

# Expose port
EXPOSE 3000

# Use exec form for CMD
CMD ["node", "server.js"]
```

### Security Headers Middleware
```javascript
// backend/src/middleware/security.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.ecommerce.local"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'same-origin' }
});

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts',
  skipSuccessfulRequests: true,
});

// Slow down repeated requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per windowMs without delay
  delayMs: 500 // add 500ms delay per request after delayAfter
});

// Input validation middleware
const validateInput = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Invalid input',
        details: error.details.map(d => d.message)
      });
    }
    next();
  };
};

// SQL injection protection
const sanitizeInput = (req, res, next) => {
  const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi;
  
  const checkForSQLInjection = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string' && sqlInjectionPattern.test(obj[key])) {
        return true;
      } else if (typeof obj[key] === 'object') {
        if (checkForSQLInjection(obj[key])) return true;
      }
    }
    return false;
  };

  if (checkForSQLInjection(req.body) || checkForSQLInjection(req.query)) {
    return res.status(400).json({ error: 'Invalid input detected' });
  }

  next();
};

module.exports = {
  securityHeaders,
  generalLimiter,
  authLimiter,
  speedLimiter,
  validateInput,
  sanitizeInput
};
```

### Vulnerability Assessment Script
```bash
#!/bin/bash
# security/vulnerability-scan.sh

set -e

echo "🔒 Starting Security Vulnerability Assessment"

# Container image scanning
echo "📦 Scanning container images..."
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image --exit-code 1 --severity HIGH,CRITICAL ecommerce-app:latest

# Kubernetes configuration scanning
echo "☸️ Scanning Kubernetes configurations..."
kube-score score k8s/*.yaml

# Infrastructure scanning
echo "🏗️ Scanning infrastructure code..."
checkov -d . --framework terraform,kubernetes,dockerfile

# Network security testing
echo "🌐 Testing network security..."
nmap -sS -O localhost

# SSL/TLS testing
echo "🔐 Testing SSL/TLS configuration..."
testssl.sh --parallel --severity HIGH https://ecommerce.local

# OWASP ZAP security testing
echo "🕷️ Running OWASP ZAP security scan..."
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://ecommerce.local -J zap-report.json

echo "✅ Security assessment completed"
```

## Assignment
1. Implement comprehensive security scanning in CI/CD pipeline
2. Set up Kubernetes security policies and RBAC
3. Configure secrets management with external providers
4. Implement security monitoring and alerting
5. Create incident response procedures

## Best Practices
- Implement security shift-left approach
- Use least privilege principle
- Regularly update dependencies and base images
- Implement proper secrets management
- Monitor for security events
- Conduct regular security assessments
- Implement defense in depth
- Train team on security best practices

## Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/)
- [Container Security Guide](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
