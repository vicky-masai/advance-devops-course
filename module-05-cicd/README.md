# Module 5: CI/CD Pipeline Implementation

## Learning Objectives
- Design and implement comprehensive CI/CD pipelines
- Set up automated testing strategies
- Implement security scanning and compliance checks
- Configure deployment strategies (Blue-Green, Canary)
- Monitor pipeline performance and reliability

## Topics Covered

### 5.1 CI/CD Fundamentals
- Pipeline design principles
- Build automation
- Testing strategies (Unit, Integration, E2E)
- Artifact management

### 5.2 Advanced Pipeline Features
- Parallel execution
- Conditional deployments
- Environment promotion
- Rollback strategies

### 5.3 Security & Compliance
- Security scanning integration
- Compliance checks
- Secret management
- Audit trails

## Hands-on Lab: Complete CI/CD Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # Code Quality and Security Checks
  code-quality:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run ESLint
      run: npm run lint

    - name: Run Prettier
      run: npm run format:check

    - name: Run security audit
      run: npm audit --audit-level high

    - name: SonarCloud Scan
      uses: SonarSource/sonarcloud-github-action@master
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  # Unit and Integration Tests
  test:
    runs-on: ubuntu-latest
    needs: code-quality
    strategy:
      matrix:
        node-version: [16, 18, 20]
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run unit tests
      run: npm run test:unit
      env:
        CI: true

    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        REDIS_URL: redis://localhost:6379

    - name: Generate test coverage
      run: npm run test:coverage

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        token: ${{ secrets.CODECOV_TOKEN }}
        files: ./coverage/lcov.info
        fail_ci_if_error: true

  # Build and Security Scan
  build:
    runs-on: ubuntu-latest
    needs: [code-quality, test]
    outputs:
      image-digest: ${{ steps.build.outputs.digest }}
      image-tag: ${{ steps.meta.outputs.tags }}
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}

    - name: Build and push Docker image
      id: build
      uses: docker/build-push-action@v5
      with:
        context: .
        platforms: linux/amd64,linux/arm64
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

  # End-to-End Tests
  e2e-tests:
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'pull_request'
    
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

    - name: Start application stack
      run: |
        docker-compose -f docker-compose.test.yml up -d
        sleep 30

    - name: Run E2E tests
      run: npm run test:e2e
      env:
        BASE_URL: http://localhost:3000

    - name: Upload E2E test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: e2e-test-results
        path: |
          test-results/
          screenshots/

    - name: Cleanup
      if: always()
      run: docker-compose -f docker-compose.test.yml down

  # Deploy to Staging
  deploy-staging:
    runs-on: ubuntu-latest
    needs: [build, e2e-tests]
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: https://staging.ecommerce.local
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.28.0'

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2

    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name staging-cluster

    - name: Deploy to staging
      run: |
        envsubst < k8s/staging/deployment.yaml | kubectl apply -f -
        kubectl rollout status deployment/ecommerce-backend -n staging
        kubectl rollout status deployment/ecommerce-frontend -n staging
      env:
        IMAGE_TAG: ${{ github.sha }}

    - name: Run smoke tests
      run: |
        kubectl wait --for=condition=ready pod -l app=ecommerce-backend -n staging --timeout=300s
        npm run test:smoke
      env:
        BASE_URL: https://staging.ecommerce.local

  # Deploy to Production
  deploy-production:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://ecommerce.local
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.28.0'

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2

    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name production-cluster

    - name: Blue-Green Deployment
      run: |
        # Deploy to green environment
        envsubst < k8s/production/deployment-green.yaml | kubectl apply -f -
        kubectl rollout status deployment/ecommerce-backend-green -n production
        kubectl rollout status deployment/ecommerce-frontend-green -n production
        
        # Run health checks
        kubectl wait --for=condition=ready pod -l app=ecommerce-backend-green -n production --timeout=300s
        
        # Switch traffic to green
        kubectl patch service ecommerce-backend -n production -p '{"spec":{"selector":{"version":"green"}}}'
        kubectl patch service ecommerce-frontend -n production -p '{"spec":{"selector":{"version":"green"}}}'
        
        # Wait and verify
        sleep 60
        npm run test:smoke
        
        # Clean up blue environment
        kubectl delete deployment ecommerce-backend-blue -n production --ignore-not-found
        kubectl delete deployment ecommerce-frontend-blue -n production --ignore-not-found
      env:
        IMAGE_TAG: ${{ github.sha }}
        BASE_URL: https://ecommerce.local

    - name: Notify deployment
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        channel: '#deployments'
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        fields: repo,message,commit,author,action,eventName,ref,workflow

  # Performance Tests
  performance-tests:
    runs-on: ubuntu-latest
    needs: deploy-production
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'

    - name: Install k6
      run: |
        sudo gpg -k
        sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6

    - name: Run performance tests
      run: k6 run --out json=results.json tests/performance/load-test.js
      env:
        BASE_URL: https://ecommerce.local

    - name: Upload performance results
      uses: actions/upload-artifact@v3
      with:
        name: performance-results
        path: results.json
```

### Docker Compose for Testing
```yaml
# docker-compose.test.yml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.test
    ports:
      - "3000:3000"
    depends_on:
      - backend
    environment:
      - REACT_APP_API_URL=http://backend:3001

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.test
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
    environment:
      - NODE_ENV=test
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/testdb
      - REDIS_URL=redis://redis:6379

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=testdb
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### Performance Test Script
```javascript
// tests/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test homepage
  let response = http.get(`${BASE_URL}/`);
  check(response, {
    'homepage status is 200': (r) => r.status === 200,
    'homepage loads in <500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);

  // Test API endpoint
  response = http.get(`${BASE_URL}/api/products`);
  check(response, {
    'API status is 200': (r) => r.status === 200,
    'API response time <200ms': (r) => r.timings.duration < 200,
    'API returns products': (r) => JSON.parse(r.body).length > 0,
  }) || errorRate.add(1);

  sleep(1);

  // Test search functionality
  response = http.get(`${BASE_URL}/api/products/search?q=laptop`);
  check(response, {
    'Search status is 200': (r) => r.status === 200,
    'Search response time <300ms': (r) => r.timings.duration < 300,
  }) || errorRate.add(1);

  sleep(2);
}
```

### Deployment Configuration
```yaml
# k8s/production/deployment-green.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecommerce-backend-green
  namespace: production
  labels:
    app: ecommerce-backend
    version: green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ecommerce-backend
      version: green
  template:
    metadata:
      labels:
        app: ecommerce-backend
        version: green
    spec:
      containers:
      - name: backend
        image: ghcr.io/company/ecommerce:${IMAGE_TAG}
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Assignment
1. Set up complete CI/CD pipeline with GitHub Actions
2. Implement automated testing at multiple levels
3. Configure security scanning and compliance checks
4. Set up blue-green deployment strategy
5. Add performance testing and monitoring

## Best Practices
- Fail fast with early quality checks
- Use parallel execution for speed
- Implement proper secret management
- Add comprehensive testing coverage
- Monitor pipeline performance
- Use infrastructure as code
- Implement proper rollback strategies
- Add security scanning at every stage

## Resources
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Kubernetes Deployment Strategies](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
